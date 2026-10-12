"""IPEADATA (API OData4). É lenta: timeout longo e retentativas."""
from __future__ import annotations

import pandas as pd

from etl.comum import Bruto, obter

BASE = "http://www.ipeadata.gov.br/api/odata4/"


def serie(codigo: str) -> tuple[pd.DataFrame, Bruto]:
    url = f"{BASE}ValoresSerie(SERCODIGO='{codigo}')"
    bruto = obter("ipeadata", f"{codigo}.json", url, timeout=300)
    vals = bruto.json()["value"]
    df = pd.DataFrame(vals)
    df["data"] = pd.to_datetime(df["VALDATA"].str[:10])
    df["valor"] = pd.to_numeric(df["VALVALOR"], errors="coerce")
    return df[["data", "valor"]].sort_values("data").reset_index(drop=True), bruto


def metadados(codigo: str) -> tuple[dict, Bruto]:
    url = f"{BASE}Metadados('{codigo}')"
    bruto = obter("ipeadata", f"{codigo}_metadados.json", url, timeout=300)
    return bruto.json()["value"][0], bruto
