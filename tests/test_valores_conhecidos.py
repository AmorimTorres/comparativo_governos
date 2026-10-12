"""Compara valores processados com números conferidos diretamente nas fontes
oficiais na Fase 1 (11/10/2026).

Se um destes testes falhar depois de uma atualização, a causa mais provável é
uma revisão na fonte (o IBGE revisa o PIB, a FAO revisa toda a série a cada
edição etc.). Confira o valor na fonte, registre a revisão em docs/DECISOES.md
e só então atualize o valor esperado.
"""
from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
import pytest

PROC = Path(__file__).resolve().parent.parent / "data" / "processed"


@pytest.fixture(scope="module")
def series():
    caminho = PROC / "series.csv"
    if not caminho.exists():
        pytest.skip("rode `make data` antes dos testes")
    return pd.read_csv(caminho, dtype={"periodo": str})


def valor(series, iid, periodo):
    s = series[(series["indicator_id"] == iid) & (series["periodo"] == periodo)]
    assert len(s) == 1, f"{iid} {periodo}: {len(s)} linhas"
    return float(s["valor"].iloc[0])


def acumulado(series, iid, ini, fim):
    s = series[(series["indicator_id"] == iid) & (series["periodo"] >= ini) & (series["periodo"] <= fim)]
    return (math.prod(1 + v / 100 for v in s["valor"]) - 1) * 100


@pytest.mark.parametrize(
    "iid,periodo,esperado,tol",
    [
        ("desemprego", "2025-12", 5.1, 0.001),       # mínimo da série (out–dez/2025)
        ("desemprego", "2020-09", 14.9, 0.001),      # máximo da série (jul–set/2020)
        ("desemprego", "2026-08", 5.3, 0.001),
        ("pib_anual", "2019", 1.2, 0.001),
        ("pib_anual", "2020", -3.3, 0.001),
        ("pib_anual", "2021", 4.8, 0.001),
        ("pib_anual", "2022", 3.0, 0.001),
        ("pib_anual", "2023", 3.2, 0.001),
        ("pib_anual", "2024", 3.4, 0.001),
        ("pib_anual", "2025", 2.3, 0.001),
        ("ipca_12m", "2021-12", 10.06, 0.001),
        ("ipca_12m", "2026-08", 4.22, 0.001),
        ("prodes_amazonia", "2021", 13038, 0.5),
        ("prodes_amazonia", "2025", 5731, 0.5),
        ("prodes_amazonia", "2006", 14286, 0.5),
        ("gini", "2024", 0.504, 0.0001),
        ("gini", "2025", 0.511, 0.0001),
        ("extrema_pobreza", "2021", 9.0, 0.001),
        ("pobreza", "2021", 36.8, 0.001),
        ("subalimentacao_fao", "2020-2022", 3.5, 0.001),
        ("inseguranca_grave_fao", "2020-2022", 8.5, 0.001),
        ("focos_queimadas", "2025-08", 18451, 0.5),
        ("ideb_anos_finais", "2023", 5.0, 0.001),
        ("ideb_anos_iniciais", "2025", 6.3, 0.001),
        ("bolsa_familia_familias", "2019-12", 13170607, 0.5),
        ("bolsa_familia_familias", "2026-08", 19289215, 0.5),
        ("analfabetismo", "2019", 6.1, 0.001),
        ("analfabetismo", "2025", 4.9, 0.001),
    ],
)
def test_valor_pontual(series, iid, periodo, esperado, tol):
    assert valor(series, iid, periodo) == pytest.approx(esperado, abs=tol)


def test_ipca_acumulado_mandato_bolsonaro(series):
    assert acumulado(series, "ipca_mensal", "2019-01", "2022-12") == pytest.approx(26.93, abs=0.01)


def test_ipca_2021_composto(series):
    assert acumulado(series, "ipca_mensal", "2021-01", "2021-12") == pytest.approx(10.06, abs=0.01)


def test_ipca_lula_ate_ago_2026(series):
    # Cartão de referência: 17,90% de jan/2023 a ago/2026.
    assert acumulado(series, "ipca_mensal", "2023-01", "2026-08") == pytest.approx(17.90, abs=0.01)


def test_fao_2023_2025_censurado(series):
    s = series[(series["indicator_id"] == "subalimentacao_fao") & (series["periodo"] == "2023-2025")]
    assert s["qualificador"].iloc[0] == "<"


def test_caged_2021(series):
    s = series[(series["indicator_id"] == "caged_saldo") & (series["periodo"].str.startswith("2021"))]
    assert s["valor"].sum() == pytest.approx(2_852_413, abs=1)


def test_homicidios_2019_contagem(series):
    s = series[(series["indicator_id"] == "homicidios_taxa") & (series["periodo"] == "2019")]
    # TabNet SIM: 44.033 agressões + 1.470 intervenções legais (dado final).
    assert "45.503 óbitos" in s["observacao"].iloc[0]
