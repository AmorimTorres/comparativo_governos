"""Leitor de XLSX em fluxo (iterparse), para planilhas grandes como o banco
VDE do Sinesp (centenas de milhares de linhas), bem mais rápido que openpyxl."""
from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Iterator

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _col_idx(ref: str) -> int:
    letras = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def linhas(conteudo: bytes, planilha: int = 0) -> Iterator[list]:
    z = zipfile.ZipFile(io.BytesIO(conteudo))
    compartilhadas: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        for _, el in ET.iterparse(z.open("xl/sharedStrings.xml")):
            if el.tag == NS + "si":
                compartilhadas.append("".join(t.text or "" for t in el.iter(NS + "t")))
                el.clear()
    folhas = sorted(
        (n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)),
        key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)),
    )
    for _, el in ET.iterparse(z.open(folhas[planilha])):
        if el.tag != NS + "row":
            continue
        valores: dict[int, object] = {}
        for c in el.iter(NS + "c"):
            ref, tipo = c.get("r"), c.get("t")
            v = c.find(NS + "v")
            if tipo == "s" and v is not None:
                val = compartilhadas[int(v.text)]
            elif tipo == "inlineStr":
                val = "".join(t.text or "" for t in c.iter(NS + "t"))
            else:
                val = v.text if v is not None else None
            valores[_col_idx(ref)] = val
        el.clear()
        if valores:
            n = max(valores) + 1
            yield [valores.get(i) for i in range(n)]
