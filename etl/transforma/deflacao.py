"""Deflação de valores nominais para reais do último mês disponível."""
from __future__ import annotations

import pandas as pd

from etl.fontes import sidra

INDICES = {
    # (tabela SIDRA, variável do número-índice)
    "IPCA": (1737, "2266"),
    "INPC": (1736, "2289"),
}


def indice_mensal(nome: str) -> tuple[pd.Series, str, str]:
    """Número-índice mensal (Series indexada pelo 1º dia do mês), mês-base e coleta."""
    tab, var = INDICES[nome]
    df, bruto = sidra.consultar(tab, var, "all")
    df = df.dropna(subset=["valor"])
    idx = pd.to_datetime(df["periodo_codigo"], format="%Y%m")
    s = pd.Series(df["valor"].to_numpy(), index=idx).sort_index()
    return s, s.index.max().strftime("%Y-%m"), bruto.coletado_em


def deflacionar(valores: pd.Series, meses: pd.Series, nome_indice: str = "IPCA") -> tuple[pd.Series, str]:
    """Converte valores nominais do mês m para reais do último mês do índice.
    Meses sem índice (posteriores ao último índice) ficam NaN."""
    s, base, _ = indice_mensal(nome_indice)
    ultimo = s.iloc[-1]
    m = pd.to_datetime(meses).dt.to_period("M").dt.to_timestamp()
    fator = ultimo / m.map(s)
    return valores.to_numpy() * fator.to_numpy(), base
