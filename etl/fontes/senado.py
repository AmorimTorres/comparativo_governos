"""Senado Federal: API de dados abertos da legislação federal. Lista os decretos
(numerados e não numerados) de cada ano, com número, data e ementa."""
from __future__ import annotations

import json
import re

import pandas as pd

from etl.comum import Bruto, hoje, obter

URL = "https://legis.senado.leg.br/dadosabertos/legislacao/lista"
URL_PAGINA = "https://legis.senado.leg.br/dadosabertos/docs/"


def decretos(ano: int) -> tuple[pd.DataFrame, Bruto]:
    """Decretos federais de um ano: norma, nome, data e ementa."""
    fechado = ano < pd.Timestamp(hoje()).year
    bruto = obter(
        "senado_legislacao", f"decretos_{ano}.json", URL,
        params={"tipo": "DEC", "ano": ano}, headers={"Accept": "application/json"},
        reaproveitar_dias=180 if fechado else None,
    )
    docs = json.loads(bruto.conteudo)["ListaDocumento"].get("documentos", {}).get("documento", [])
    if isinstance(docs, dict):
        docs = [docs]
    df = pd.DataFrame(
        # norma: DEC-11874-2023-12-29 (numerado) ou DEC-2011-04-19-s2 (não numerado)
        [{"norma": d["norma"], "nome": d.get("normaNome", ""), "data": re.search(r"\d{4}-\d{2}-\d{2}", d["norma"]).group(0), "ementa": d.get("ementa", "")} for d in docs]
    )
    if df.empty:
        return pd.DataFrame(columns=["norma", "nome", "data", "ementa"]), bruto
    df["data"] = pd.to_datetime(df["data"])
    return df, bruto
