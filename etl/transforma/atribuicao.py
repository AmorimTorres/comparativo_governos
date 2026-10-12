"""Atribuição de cada observação a um governo, com mês e ano do mandato.

Regras (documentadas em docs/METODOLOGIA.md):

- regra "centro" (padrão): o governo é o do ponto médio do período. Equivale
  à regra da maioria dos meses: o ano PRODES ago/AAAA-1–jul/AAAA vai para quem
  governava em janeiro de AAAA (7 de 12 meses), e o triênio da FAO vai para o
  governo com 2 dos 3 anos.
- regra "fim": o governo é o do último dia do período. Usada no trimestre
  móvel da PNAD, que o IBGE identifica pelo mês final.

Quando o período cruza a troca de governo, a observação recebe uma nota de
transição com o número de meses que pertencem ao outro governo.

`mes_do_mandato` (1–48) só existe para dados mensais, de trimestre móvel e
trimestrais, e é contado pelo mês final do período. `ano_do_mandato` (1–4) é
contado pelo ano da data de referência da regra.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import pandas as pd

from etl.comum import ler_yaml

PERIODICIDADES_MENSAIS = {"mensal", "trimestre_movel", "trimestral"}

MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


@dataclass(frozen=True)
class Governo:
    id: str
    nome: str
    inicio: dt.date
    fim: dt.date
    em_curso: bool


def carregar_governos() -> list[Governo]:
    cfg = ler_yaml("governos.yaml")
    out = []
    for g in cfg["governos"]:
        out.append(
            Governo(
                id=g["id"],
                nome=g["nome"],
                inicio=pd.Timestamp(g["inicio"]).date(),
                fim=pd.Timestamp(g["fim"]).date(),
                em_curso=bool(g.get("em_curso", False)),
            )
        )
    return sorted(out, key=lambda g: g.inicio)


def governo_em(data: dt.date, governos: list[Governo]) -> Governo | None:
    for g in governos:
        if g.inicio <= data <= g.fim:
            return g
    return None


def _meses_entre(a: dt.date, b: dt.date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def _meses_por_governo(ini: dt.date, fim: dt.date, governos: list[Governo]) -> dict[str, int]:
    """Conta quantos meses do período [ini, fim] caem em cada governo (pelo dia 15)."""
    cont: dict[str, int] = {}
    ano, mes = ini.year, ini.month
    while (ano, mes) <= (fim.year, fim.month):
        g = governo_em(dt.date(ano, mes, 15), governos)
        chave = g.id if g else "outro"
        cont[chave] = cont.get(chave, 0) + 1
        mes += 1
        if mes == 13:
            ano, mes = ano + 1, 1
    return cont


def mes_ano_pt(d: dt.date) -> str:
    return f"{MESES_PT[d.month - 1]}/{d.year}"


def atribuir(df: pd.DataFrame, periodicidade: str, regra: str = "centro") -> pd.DataFrame:
    """Acrescenta governo, mes_do_mandato, ano_do_mandato e nota de transição.

    `df` precisa das colunas data_inicio e data_fim (datas ISO).
    """
    governos = carregar_governos()
    df = df.copy()
    gov_col, mes_col, ano_col, notas = [], [], [], []
    for ini_s, fim_s in zip(df["data_inicio"], df["data_fim"]):
        ini = pd.Timestamp(ini_s).date()
        fim = pd.Timestamp(fim_s).date()
        if regra == "fim":
            ref = fim
        elif regra == "centro":
            ref = ini + (fim - ini) / 2
        else:
            raise ValueError(f"regra de atribuição desconhecida: {regra}")
        g = governo_em(ref, governos)
        if g is None:
            gov_col.append("outro")
            mes_col.append(pd.NA)
            ano_col.append(pd.NA)
            notas.append("")
            continue
        gov_col.append(g.id)
        if periodicidade in PERIODICIDADES_MENSAIS:
            mes_col.append(_meses_entre(g.inicio, fim) + 1)
        else:
            mes_col.append(pd.NA)
        ano_col.append(ref.year - g.inicio.year + 1)
        cont = _meses_por_governo(ini, fim, governos)
        fora = sum(v for k, v in cont.items() if k != g.id)
        total = sum(cont.values())
        if fora:
            notas.append(f"transição: {fora} de {total} meses fora do governo atribuído")
        else:
            notas.append("")
    df["governo"] = gov_col
    df["mes_do_mandato"] = pd.array(mes_col, dtype="Int64")
    df["ano_do_mandato"] = pd.array(ano_col, dtype="Int64")
    df["nota_transicao"] = notas
    return df


def descricao_periodo(ini: dt.date, fim: dt.date) -> str:
    return f"{mes_ano_pt(ini)}–{mes_ano_pt(fim)}"
