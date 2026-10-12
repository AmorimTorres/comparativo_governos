"""Resumos por governo (resumos_por_governo.csv).

Para cada indicador e governo comparado: média, acumulado, início e fim,
mínimo e máximo (com o período), período coberto, número de observações e se
o mandato está completo. Também a "janela comum": só as posições do mandato
(mês ou ano do mandato) que existem nos dois governos comparados.
"""
from __future__ import annotations

import math

import pandas as pd

from etl.transforma.atribuicao import MESES_PT, PERIODICIDADES_MENSAIS

ESPERADO = {"mensal": 48, "trimestre_movel": 48, "trimestral": 16, "anual": 4, "anual_prodes": 4, "bienal": 2, "trienal": 4}


def _acumular(valores: pd.Series, modo: str) -> float:
    if not modo or valores.empty:
        return float("nan")
    if modo == "composto":
        fator = 1.0
        for v in valores:
            fator *= 1 + v / 100
        return (fator - 1) * 100
    if modo == "soma":
        return float(valores.sum())
    raise ValueError(modo)


def _rotulo_periodo(periodo: str, periodicidade: str) -> str:
    if periodicidade in ("mensal", "trimestre_movel"):
        a, m = periodo.split("-")
        return f"{MESES_PT[int(m) - 1]}/{a}"
    if periodicidade == "trimestral":
        a, t = periodo.split("T")
        return f"{t}º tri/{a}"
    return periodo


def _cobertura(obs: pd.DataFrame, periodicidade: str) -> str:
    if obs.empty:
        return ""
    ini = _rotulo_periodo(obs["periodo"].iloc[0], periodicidade)
    fim = _rotulo_periodo(obs["periodo"].iloc[-1], periodicidade)
    if periodicidade == "anual_prodes":
        return f"PRODES {ini}–{fim}"
    if periodicidade == "trienal":
        return f"triênios {ini} a {fim}"
    return f"{ini}–{fim}" if ini != fim else ini


def _janela_desc(pos: list[int], periodicidade: str) -> str:
    if not pos:
        return ""
    mensal = periodicidade in PERIODICIDADES_MENSAIS
    plural, singular = ("meses", "mês") if mensal else ("anos", "ano")
    a, b = min(pos), max(pos)
    if a == b:
        return f"{singular} {a} do mandato"
    passo = 3 if periodicidade == "trimestral" else 1
    esperado = list(range(a, b + 1, passo))
    if list(pos) == esperado:
        return f"{plural} {a}–{b} do mandato"
    faltam = [p for p in esperado if p not in pos]
    if len(faltam) <= 3:
        lista = faltam[0] if len(faltam) == 1 else ", ".join(str(p) for p in faltam[:-1]) + f" e {faltam[-1]}"
        return f"{plural} {a}–{b} do mandato, exceto {lista}"
    if len(pos) <= 4:
        return f"{plural} {', '.join(str(p) for p in pos[:-1])} e {pos[-1]} do mandato"
    return f"{len(pos)} {plural} entre o {a}º e o {b}º do mandato"


def resumir(series: pd.DataFrame, catalogo: dict, governos: list, comparados: list[str]) -> pd.DataFrame:
    em_curso = {g.id: g.em_curso for g in governos}
    linhas = []
    for iid, cat in catalogo.items():
        s = series[(series["indicator_id"] == iid) & (series["entra_no_resumo"])].sort_values("data_inicio")
        per = cat["periodicidade"]
        chave_pos = "mes_do_mandato" if per in PERIODICIDADES_MENSAIS else "ano_do_mandato"
        grupos = {g: s[s["governo"] == g] for g in comparados}
        posicoes = [set(grupos[g][chave_pos].dropna().astype(int)) for g in comparados]
        comuns = sorted(set.intersection(*posicoes)) if posicoes and all(posicoes) else []
        for g in comparados:
            obs = grupos[g]
            if obs.empty:
                continue
            censurado = (obs["qualificador"] != "").any()
            notas = []
            if censurado:
                notas.append("há valores censurados (ex.: '<2,5'); média não calculada")
            i_min, i_max = obs["valor"].idxmin(), obs["valor"].idxmax()
            jan = obs[obs[chave_pos].isin(comuns)] if comuns else obs.iloc[0:0]
            n_esp = ESPERADO.get(per)
            completo = (not em_curso.get(g, False)) and n_esp is not None and len(obs) >= n_esp
            linhas.append({
                "indicator_id": iid,
                "governo": g,
                "media": float("nan") if censurado else obs["valor"].mean(),
                "acumulado": _acumular(obs["valor"], cat.get("acumulado") or ""),
                "valor_inicio": obs["valor"].iloc[0],
                "periodo_inicio": obs["periodo"].iloc[0],
                "valor_fim": obs["valor"].iloc[-1],
                "periodo_fim": obs["periodo"].iloc[-1],
                "minimo": obs.loc[i_min, "valor"],
                "periodo_minimo": obs.loc[i_min, "periodo"],
                "maximo": obs.loc[i_max, "valor"],
                "periodo_maximo": obs.loc[i_max, "periodo"],
                "periodo_coberto": _cobertura(obs, per),
                "n_observacoes": len(obs),
                "mandato_completo": bool(completo),
                "n_janela_comum": len(jan),
                "janela_comum": _janela_desc(comuns, per),
                "media_janela_comum": float("nan") if (censurado or jan.empty) else jan["valor"].mean(),
                "acumulado_janela_comum": _acumular(jan["valor"], cat.get("acumulado") or "") if not jan.empty else float("nan"),
                "valor_inicio_janela_comum": jan["valor"].iloc[0] if not jan.empty else float("nan"),
                "periodo_inicio_janela_comum": jan["periodo"].iloc[0] if not jan.empty else "",
                "valor_fim_janela_comum": jan["valor"].iloc[-1] if not jan.empty else float("nan"),
                "periodo_fim_janela_comum": jan["periodo"].iloc[-1] if not jan.empty else "",
                "minimo_janela_comum": jan["valor"].min() if not jan.empty else float("nan"),
                "periodo_minimo_janela_comum": jan.loc[jan["valor"].idxmin(), "periodo"] if not jan.empty else "",
                "maximo_janela_comum": jan["valor"].max() if not jan.empty else float("nan"),
                "periodo_maximo_janela_comum": jan.loc[jan["valor"].idxmax(), "periodo"] if not jan.empty else "",
                "periodo_coberto_janela_comum": _cobertura(jan, per),
                # Períodos cujo valor é só um limite (ex.: FAO "<2,5"): o painel exibe "menos de".
                "periodos_censurados": ";".join(obs.loc[obs["qualificador"] != "", "periodo"]),
                "observacao": "; ".join(notas),
            })
    df = pd.DataFrame(linhas)
    for c in df.columns:
        if df[c].dtype == float:
            df[c] = df[c].map(lambda x: x if (x is None or math.isnan(x)) else round(x, 6))
    return df
