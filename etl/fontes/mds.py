"""MDS/SAGI: MI Social (Solr), dados municipais mensais de programas sociais.

A soma nacional por mês é obtida numa única consulta com stats.facet.
"""
from __future__ import annotations

import pandas as pd

from etl.comum import Bruto, obter

BASE = "https://aplicacoes.mds.gov.br/sagi/servicos/misocial/"
URL_PAGINA = "https://aplicacoes.mds.gov.br/sagi/vis/data3/"


def soma_mensal(campo: str, inicio: str = "201201", fim: str = "209912") -> tuple[pd.DataFrame, Bruto]:
    params = {
        "q": "*:*",
        "rows": 0,
        "wt": "json",
        "fq": f"anomes_s:[{inicio} TO {fim}]",
        "stats": "true",
        "stats.field": campo,
        "stats.facet": "anomes_s",
    }
    bruto = obter("mds_misocial", f"{campo}_{inicio}_{fim}.json", BASE, params=params, timeout=300)
    st = bruto.json()["stats"]["stats_fields"][campo]
    facetas = (st or {}).get("facets", {}).get("anomes_s", {})
    linhas = [
        {"anomes": k, "soma": v.get("sum"), "municipios": v.get("count")}
        for k, v in facetas.items()
    ]
    df = pd.DataFrame(linhas)
    if df.empty:
        return df, bruto
    df["data"] = pd.to_datetime(df["anomes"], format="%Y%m")
    return df.sort_values("data").reset_index(drop=True), bruto
