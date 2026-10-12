"""Testes de estrutura dos CSVs processados e das regras de atribuição."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd
import pytest

from etl.comum import ler_yaml
from etl.transforma.atribuicao import atribuir
from etl.valida.checks import verificar

PROC = Path(__file__).resolve().parent.parent / "data" / "processed"


@pytest.fixture(scope="module")
def dados():
    if not (PROC / "series.csv").exists():
        pytest.skip("rode `make data` antes dos testes")
    series = pd.read_csv(PROC / "series.csv", dtype={"periodo": str})
    series["qualificador"] = series["qualificador"].fillna("")
    series["mes_do_mandato"] = series["mes_do_mandato"].astype("Int64")
    series["ano_do_mandato"] = series["ano_do_mandato"].astype("Int64")
    resumos = pd.read_csv(PROC / "resumos_por_governo.csv")
    catalogo = pd.read_csv(PROC / "catalogo_indicadores.csv")
    eventos = pd.read_csv(PROC / "eventos_contexto.csv")
    return series, resumos, catalogo, eventos


def test_colunas_pedidas(dados):
    series, resumos, catalogo, eventos = dados
    assert {"indicator_id", "tema", "nome", "descricao_curta", "unidade", "periodicidade", "sentido_desejavel",
            "fonte_orgao", "fonte_tabela_ou_serie", "url_fonte", "url_api", "metodologia_resumo", "ressalvas",
            "quebra_metodologica", "nivel_geografico"} <= set(catalogo.columns)
    assert {"indicator_id", "periodo", "data_inicio", "data_fim", "valor", "unidade", "uf", "governo",
            "mes_do_mandato", "ano_do_mandato", "parcial", "coletado_em", "fonte_url", "observacao"} <= set(series.columns)
    assert {"indicator_id", "governo", "media", "acumulado", "valor_inicio", "valor_fim", "minimo", "maximo",
            "periodo_coberto", "n_observacoes", "mandato_completo"} <= set(resumos.columns)
    assert {"data_inicio", "data_fim", "evento", "categoria", "indicadores_afetados", "fonte_url"} <= set(eventos.columns)


def test_validacoes_sem_problemas(dados):
    series, resumos, catalogo, _ = dados
    cfg = {i["indicator_id"]: i for i in ler_yaml("indicadores.yaml")["indicadores"]}
    presentes = {k: v for k, v in cfg.items() if k in set(series["indicator_id"])}
    assert verificar(series, presentes, resumos) == []


def test_todos_os_indicadores_do_catalogo_tem_dados(dados):
    series, _, catalogo, _ = dados
    assert set(catalogo["indicator_id"]) == set(series["indicator_id"])


def test_governos_validos(dados):
    series = dados[0]
    assert set(series["governo"]) <= {"bolsonaro", "lula3", "outro"}
    assert (series["uf"] == "BR").all()


def test_lula_nunca_mandato_completo(dados):
    resumos = dados[1]
    assert not resumos.loc[resumos["governo"] == "lula3", "mandato_completo"].any()


def test_eventos_tem_fonte(dados):
    eventos = dados[3]
    assert eventos["fonte_url"].fillna("").str.startswith(("http", "ftp")).all()
    ids = set(dados[2]["indicator_id"])
    for lista in eventos["indicadores_afetados"].fillna(""):
        assert set(x for x in lista.split(";") if x) <= ids


def _linha(ini, fim):
    return pd.DataFrame({"data_inicio": [ini], "data_fim": [fim]})


def test_regra_prodes_maioria_dos_meses():
    # PRODES 2023 (ago/2022–jul/2023): 7 meses no governo Lula 3.
    r = atribuir(_linha(dt.date(2022, 8, 1), dt.date(2023, 7, 31)), "anual_prodes", "centro").iloc[0]
    assert r["governo"] == "lula3" and r["ano_do_mandato"] == 1
    assert "transição: 5 de 12" in r["nota_transicao"]


def test_regra_trienio_fao():
    r = atribuir(_linha(dt.date(2021, 1, 1), dt.date(2023, 12, 31)), "trienal", "centro").iloc[0]
    assert r["governo"] == "bolsonaro"
    r = atribuir(_linha(dt.date(2022, 1, 1), dt.date(2024, 12, 31)), "trienal", "centro").iloc[0]
    assert r["governo"] == "lula3"


def test_regra_trimestre_movel_mes_final():
    r = atribuir(_linha(dt.date(2022, 11, 1), dt.date(2023, 1, 31)), "trimestre_movel", "fim").iloc[0]
    assert r["governo"] == "lula3" and r["mes_do_mandato"] == 1
    assert r["nota_transicao"].startswith("transição")


def test_mes_do_mandato_mensal():
    r = atribuir(_linha(dt.date(2022, 12, 1), dt.date(2022, 12, 31)), "mensal", "centro").iloc[0]
    assert r["governo"] == "bolsonaro" and r["mes_do_mandato"] == 48 and r["ano_do_mandato"] == 4


def test_antes_de_2019_e_outro():
    r = atribuir(_linha(dt.date(2018, 6, 1), dt.date(2018, 6, 30)), "mensal", "centro").iloc[0]
    assert r["governo"] == "outro" and pd.isna(r["mes_do_mandato"])
