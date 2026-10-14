"""Tesouro Nacional, SICONFI: Relatório Resumido da Execução Orçamentária (RREO)
da União, pela API de dados abertos (apidatalake)."""
from __future__ import annotations

import json

import pandas as pd

from etl.comum import Bruto, NaoEncontrado, obter

URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo"
URL_PAGINA = "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra_rreo/finbra_rreo_list.jsf"


def rreo_uniao(ano: int, anexo: str, periodo: int = 6) -> tuple[pd.DataFrame, Bruto]:
    """Linhas de um anexo do RREO da União (período 6 = ano fechado)."""
    params = {"an_exercicio": ano, "nr_periodo": periodo, "co_tipo_demonstrativo": "RREO", "no_anexo": anexo, "co_esfera": "U", "id_ente": 1}
    nome = f"rreo_{anexo.replace(' ', '_').replace('-', '')}_{ano}_p{periodo}.json"
    bruto = obter("tesouro_siconfi", nome, URL, params=params, reaproveitar_dias=90 if ano < pd.Timestamp.today().year - 1 else None)
    itens = json.loads(bruto.conteudo).get("items", [])
    if not itens:
        raise NaoEncontrado(f"RREO {anexo} {ano} sem dados")
    return pd.DataFrame(itens), bruto
