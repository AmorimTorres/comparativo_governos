"""Banco Central do Brasil, SGS (api.bcb.gov.br)."""
from __future__ import annotations

import datetime as dt

import pandas as pd

from etl.comum import Bruto, obter

BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados"


def serie(codigo: int, inicio: str = "2012-01-01", fim: str | None = None, diaria: bool = False) -> tuple[pd.DataFrame, list[Bruto]]:
    """Baixa uma série do SGS. Séries diárias são divididas em janelas de 5 anos
    (a API limita consultas diárias a 10 anos)."""
    ini = pd.Timestamp(inicio).date()
    fim_d = pd.Timestamp(fim).date() if fim else dt.date.today()
    janelas = []
    if diaria:
        a = ini
        while a <= fim_d:
            b = min(dt.date(a.year + 5, a.month, a.day) - dt.timedelta(days=1), fim_d)
            janelas.append((a, b))
            a = b + dt.timedelta(days=1)
    else:
        janelas.append((ini, fim_d))
    partes, brutos = [], []
    for a, b in janelas:
        params = {"formato": "json", "dataInicial": a.strftime("%d/%m/%Y"), "dataFinal": b.strftime("%d/%m/%Y")}
        nome = f"sgs{codigo}_{a.isoformat()}_{b.isoformat()}.json"
        bruto = obter("bcb_sgs", nome, BASE.format(codigo=codigo), params=params)
        brutos.append(bruto)
        js = bruto.json()
        if js:
            partes.append(pd.DataFrame(js))
    df = pd.concat(partes, ignore_index=True) if partes else pd.DataFrame(columns=["data", "valor"])
    df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y")
    df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
    df = df.drop_duplicates("data").sort_values("data").reset_index(drop=True)
    return df, brutos


def url_serie(codigo: int) -> str:
    return f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json"
