"""IBGE SIDRA (API de valores: apisidra.ibge.gov.br)."""
from __future__ import annotations

import re

import pandas as pd

from etl.comum import Bruto, obter

BASE = "https://apisidra.ibge.gov.br/values"
COLUNAS_PERIODO = ("Mês", "Trimestre", "Ano", "Trimestre Móvel", "Trimestre móvel")


def consultar(
    tabela: int,
    variaveis: str,
    periodos: str = "all",
    classificacoes: dict[int, str] | None = None,
    nivel: str = "n1/all",
) -> tuple[pd.DataFrame, Bruto]:
    """Consulta a API de valores e devolve (dataframe, bruto).

    O dataframe tem: variavel, periodo_codigo, periodo_nome, valor (float ou NaN),
    valor_texto e uma coluna por classificação (código da categoria).
    """
    caminho = f"/t/{tabela}/{nivel}/v/{variaveis}/p/{periodos}"
    for cod, cat in (classificacoes or {}).items():
        caminho += f"/c{cod}/{cat}"
    url = BASE + caminho
    nome = re.sub(r"[^0-9A-Za-z]+", "_", caminho.strip("/")) + ".json"
    bruto = obter("ibge_sidra", nome, url)
    dados = bruto.json()
    cab, linhas = dados[0], dados[1:]
    rotulos = {k: v for k, v in cab.items()}
    chave_per = next(
        k[:-1] + "C"
        for k, v in rotulos.items()
        if k.endswith("N") and v in COLUNAS_PERIODO
    )
    chave_var = next(k for k, v in rotulos.items() if v == "Variável (Código)")
    registros = []
    for l in linhas:
        txt = l["V"]
        try:
            val = float(txt)
        except ValueError:
            val = float("nan")
        reg = {
            "variavel": l[chave_var],
            "periodo_codigo": l[chave_per],
            "periodo_nome": l[chave_per[:-1] + "N"],
            "valor": val,
            "valor_texto": txt,
        }
        for k, v in rotulos.items():
            if k.endswith("C") and k not in (chave_per, chave_var, "NC", "MC") and not v.startswith(("Brasil", "Unidade")):
                reg[v.replace(" (Código)", "")] = l[k]
        registros.append(reg)
    return pd.DataFrame(registros), bruto
