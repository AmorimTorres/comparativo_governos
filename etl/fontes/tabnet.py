"""DATASUS TabNet: tabulações oficiais do SIM e do SINASC via formulário (POST).

O TabNet devolve a tabela em formato "prn" (CSV com ponto e vírgula) dentro
de um <PRE>. Os arquivos .dbf de cada ano incluem os anos com dados
preliminares (o próprio TabNet sinaliza na nota de rodapé).
"""
from __future__ import annotations

import hashlib
import html as htmlmod
import io
import re
import urllib.parse

import pandas as pd

from etl.comum import Bruto, obter

BASE = "http://tabnet.datasus.gov.br/cgi/"


def _formulario(definicao: str) -> str:
    b = obter("datasus_tabnet", definicao.replace("/", "_") + ".html", BASE + "deftohtm.exe?" + definicao)
    return b.conteudo.decode("latin1")


def campos_selecao(definicao: str) -> list[str]:
    return re.findall(r'NAME="(S[^"]+)"', _formulario(definicao))


def opcoes(definicao: str, campo: str) -> list[tuple[str, str]]:
    """Opções (valor, rótulo) de um campo de seleção do formulário."""
    h = _formulario(definicao)
    m = re.search(r'NAME="%s"(.*?)</SELECT>' % re.escape(campo), h, re.S | re.I)
    if not m:
        raise KeyError(campo)
    return [
        (v, htmlmod.unescape(re.sub(r"\s+", " ", t)).strip())
        for v, t in re.findall(r'VALUE="([^"]*)"[^>]*>([^<]*)', m.group(1))
    ]


def valores(definicao: str, campo: str, rotulos: list[str]) -> list[str]:
    """Valores de seleção cujos rótulos são exatamente os informados."""
    mapa = {r: v for v, r in opcoes(definicao, campo)}
    faltando = [r for r in rotulos if r not in mapa]
    if faltando:
        raise KeyError(f"{campo}: rótulos não encontrados {faltando}")
    return [mapa[r] for r in rotulos]


def consultar(
    definicao: str,
    linha: str,
    coluna: str,
    incremento: str,
    arquivos: list[str],
    selecoes: dict[str, list[str]] | None = None,
) -> tuple[pd.DataFrame, Bruto]:
    """Executa uma tabulação. `selecoes` mapeia o campo (ex.: 'SGrupo_CID-10')
    para a lista de valores; os demais campos ficam em TODAS_AS_CATEGORIAS__."""
    selecoes = selecoes or {}
    campos = [("Linha", linha), ("Coluna", coluna), ("Incremento", incremento)]
    campos += [("Arquivos", a) for a in arquivos]
    for s in campos_selecao(definicao):
        for v in selecoes.get(s, ["TODAS_AS_CATEGORIAS__"]):
            campos.append((s, v))
    campos += [("formato", "prn"), ("mostre", "Mostra")]
    corpo = urllib.parse.urlencode(campos, encoding="latin1")
    chave = hashlib.sha1(corpo.encode()).hexdigest()[:12]
    nome = f"{definicao.replace('/', '_')}_{chave}.html"
    bruto = obter(
        "datasus_tabnet",
        nome,
        BASE + "tabcgi.exe?" + definicao,
        metodo="POST",
        data=corpo,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        params=None,
        timeout=300,
    )
    html = bruto.conteudo.decode("latin1")
    pre = re.search(r"<PRE>(.*?)</PRE>", html, re.S | re.I)
    if not pre:
        raise RuntimeError(f"TabNet não devolveu tabela para {definicao}: {re.sub('<[^>]+>', ' ', html)[:300]}")
    txt = re.sub(r"<[^>]+>", "", pre.group(1)).strip()
    df = pd.read_csv(io.StringIO(txt), sep=";", dtype=str)
    df.columns = [htmlmod.unescape(c.strip().strip('"')) for c in df.columns]
    rot = df.columns[0]
    df[rot] = df[rot].fillna("").map(lambda x: htmlmod.unescape(x.strip().strip('"')))
    for c in df.columns[1:]:
        df[c] = pd.to_numeric(df[c].str.replace(".", "", regex=False).str.replace("-", "0", regex=False), errors="coerce")
    return df, bruto


def nota_rodape(bruto: Bruto) -> str:
    """Texto das notas da tabulação (fonte, anos finais e preliminares)."""
    h = bruto.conteudo.decode("latin1")
    resto = h.split("</PRE>")[-1] if "</PRE>" in h else h
    return re.sub(r"\s+", " ", htmlmod.unescape(re.sub(r"<[^>]+>", " ", resto))).strip()


def ultimo_ano_final(bruto: Bruto) -> int:
    """Último ano com dados finais, conforme a nota oficial do TabNet."""
    m = re.search(r"[Dd]ados finais dispon[ií]veis at[ée] (\d{4})", nota_rodape(bruto))
    if not m:
        raise RuntimeError("Nota do TabNet sem 'Dados finais disponíveis até AAAA'")
    return int(m.group(1))


MESES = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}


def linhas_ano_mes(df: pd.DataFrame) -> pd.DataFrame:
    """Converte a saída com Linha=Ano/mês (linhas '..Janeiro/2019') em
    colunas ano, mes, valor (descarta subtotais anuais e o total)."""
    rot, col = df.columns[0], df.columns[1]
    out = []
    for r, v in zip(df[rot], df[col]):
        m = re.match(r"^\.*\s*([A-Za-zçÇ]+)/(\d{4})$", r)
        if m and m.group(1).lower() in MESES:
            out.append({"ano": int(m.group(2)), "mes": MESES[m.group(1).lower()], "valor": v})
    return pd.DataFrame(out)
