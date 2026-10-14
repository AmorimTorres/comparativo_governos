"""Validações automáticas dos dados processados.

Cada verificação devolve uma lista de problemas (texto). O pipeline falha se
houver qualquer problema, para que dados quebrados não cheguem ao painel.
"""
from __future__ import annotations

import pandas as pd

from etl.transforma.atribuicao import PERIODICIDADES_MENSAIS, carregar_governos

# Faixas plausíveis (limites largos de bom senso, não valores esperados).
FAIXAS = {
    "desemprego": (2, 25),
    "pib_anual": (-15, 15),
    "pib_trimestral": (-15, 15),
    "rendimento_real": (1000, 10000),
    "caged_saldo": (-1_500_000, 1_000_000),
    "informalidade": (20, 60),
    "salario_minimo_real": (500, 3000),
    "ipca_mensal": (-3, 5),
    "ipca_12m": (-3, 20),
    "ipca_alimentos": (-5, 8),
    "gasolina_real": (2, 15),
    "glp_real": (40, 250),
    "diesel_real": (2, 15),
    "extrema_pobreza": (0, 30),
    "pobreza": (5, 60),
    "gini": (0.4, 0.7),
    "subalimentacao_fao": (0, 30),
    "inseguranca_grave_fao": (0, 30),
    "bolsa_familia_familias": (5_000_000, 30_000_000),
    "bolsa_familia_beneficio_real": (10, 2000),
    "prodes_amazonia": (2000, 35000),
    "prodes_cerrado": (2000, 35000),
    "deter_amazonia": (0, 6000),
    "focos_queimadas": (0, 150_000),
    "mortalidade_infantil": (5, 30),
    "covid_obitos": (0, 120_000),
    "homicidios_taxa": (10, 40),
    "homicidios_mensal": (1000, 7000),
    "feminicidios": (20, 300),
    "mortalidade_materna": (20, 250),
    "vacina_sarampo": (40, 100),
    "vacina_dtp3": (40, 100),
    "cirurgias_eletivas": (30_000, 450_000),
    "obitos_dengue": (20, 12_000),
    "suicidios_taxa": (2, 15),
    "gasto_federal_saude": (80, 600),
    "mulheres_assassinadas": (100, 600),
    "feminicidio_parcela": (5, 80),
    "homicidios_mulheres_taxa": (1, 10),
    "latrocinios": (20, 300),
    "roubo_veiculos": (2000, 40000),
    "ideb_anos_iniciais": (3, 8),
    "ideb_anos_finais": (3, 8),
    "ideb_ensino_medio": (2, 8),
    "analfabetismo": (2, 15),
    "selic_meta": (1, 20),
    "cambio": (1.5, 8),
    "endividamento_familias": (20, 70),
    "inadimplencia_pf": (1, 10),
    "divida_bruta": (40, 110),
    "resultado_primario": (-15, 5),
    "balanca_comercial": (-10_000, 20_000),
}

# Lacunas conhecidas e justificadas (períodos sem dado na fonte).
LACUNAS_CONHECIDAS = {
    "gasolina_real": {"2020-09"},  # ANP: sem pesquisa entre 18/8 e 17/10/2020
    "glp_real": {"2020-09"},
    "diesel_real": {"2020-09"},
    "analfabetismo": {"2020", "2021"},  # PNAD Educação não coletada na pandemia
}


def _periodos_esperados(primeiro: str, ultimo: str, periodicidade: str) -> list[str]:
    if periodicidade in ("mensal", "trimestre_movel"):
        return [p.strftime("%Y-%m") for p in pd.period_range(primeiro, ultimo, freq="M")]
    if periodicidade == "trimestral":
        a = pd.Period(primeiro.replace("T", "Q"), freq="Q")
        b = pd.Period(ultimo.replace("T", "Q"), freq="Q")
        return [f"{p.year}T{p.quarter}" for p in pd.period_range(a, b, freq="Q")]
    if periodicidade in ("anual", "anual_prodes"):
        return [str(a) for a in range(int(primeiro), int(ultimo) + 1)]
    if periodicidade == "bienal":
        return [str(a) for a in range(int(primeiro), int(ultimo) + 1, 2)]
    return []


def verificar(series: pd.DataFrame, catalogo: dict, resumos: pd.DataFrame) -> list[str]:
    problemas: list[str] = []

    dup = series.duplicated(["indicator_id", "periodo", "uf"], keep=False)
    if dup.any():
        problemas.append(f"duplicatas: {series.loc[dup, ['indicator_id', 'periodo']].drop_duplicates().values.tolist()[:10]}")

    for iid, cat in catalogo.items():
        s = series[series["indicator_id"] == iid]
        if s.empty:
            problemas.append(f"{iid}: sem dados")
            continue
        if (s["unidade"] != cat["unidade"]).any():
            problemas.append(f"{iid}: unidade diferente do catálogo")
        if s["valor"].isna().any():
            problemas.append(f"{iid}: valores vazios em {s.loc[s['valor'].isna(), 'periodo'].tolist()[:5]}")
        lo, hi = FAIXAS.get(iid, (None, None))
        if lo is not None:
            # Meses marcados como parciais (ex.: ainda incompletos na fonte) são esperados fora da faixa.
            completos = s[~s["parcial"].astype(bool)]
            fora = completos[(completos["valor"] < lo) | (completos["valor"] > hi)]
            if not fora.empty:
                problemas.append(f"{iid}: valores fora da faixa plausível [{lo}, {hi}]: {fora[['periodo', 'valor']].values.tolist()[:5]}")
        esperados = _periodos_esperados(s["periodo"].iloc[0], s["periodo"].iloc[-1], cat["periodicidade"])
        if esperados:
            faltando = sorted(set(esperados) - set(s["periodo"]) - LACUNAS_CONHECIDAS.get(iid, set()))
            if faltando:
                problemas.append(f"{iid}: buracos inesperados na série: {faltando[:8]}")
        if cat["periodicidade"] in PERIODICIDADES_MENSAIS:
            m = s["mes_do_mandato"].dropna()
            if not m.between(1, 48).all():
                problemas.append(f"{iid}: mes_do_mandato fora de 1–48")
        a = s["ano_do_mandato"].dropna()
        if not a.between(1, 4).all():
            problemas.append(f"{iid}: ano_do_mandato fora de 1–4")

    # Governo coerente com as datas: período inteiramente dentro de um mandato
    # tem de ser atribuído a esse mandato.
    for g in carregar_governos():
        ini = pd.to_datetime(series["data_inicio"]).dt.date
        fim = pd.to_datetime(series["data_fim"]).dt.date
        dentro = (ini >= g.inicio) & (fim <= g.fim)
        errados = series[dentro & (series["governo"] != g.id)]
        if not errados.empty:
            problemas.append(f"governo incoerente com as datas em {errados[['indicator_id', 'periodo']].values.tolist()[:5]}")

    if not resumos.empty:
        ruins = resumos[resumos["n_observacoes"] <= 0]
        if not ruins.empty:
            problemas.append("resumos sem observações")
        lula = resumos[resumos["governo"] == "lula3"]
        if lula["mandato_completo"].any():
            problemas.append("mandato em curso marcado como completo")
    return problemas
