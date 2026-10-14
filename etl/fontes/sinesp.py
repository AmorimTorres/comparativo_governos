"""MJSP/Sinesp VDE: banco anual de ocorrências e vítimas (gestores estaduais)."""
from __future__ import annotations

import datetime as dt
import hashlib

import pandas as pd

from etl.comum import DIR_INTERIM, Bruto, obter
from etl.fontes import xlsx

URL = "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/dnsp-base-de-dados/bancovde-{ano}.xlsx/@@download/file"
URL_PAGINA = (
    "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/"
    "base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023"
)
EXCEL_ZERO = dt.date(1899, 12, 30)


def _num(x) -> float:
    if x in (None, "", "-"):
        return 0.0
    try:
        return float(x)
    except ValueError:
        return 0.0


def mensal_brasil(ano: int, eventos: set[str]) -> tuple[pd.DataFrame, Bruto]:
    """Soma nacional por mês e evento: colunas total (ocorrências),
    total_vitima (vítimas), vitimas_mulheres (vítimas do sexo feminino) e
    n_ufs (UFs com registro no mês)."""
    # Anos antigos mudam pouco: reaproveita cópia de até 30 dias.
    antigo = ano < dt.date.today().year - 1
    bruto = obter("mj_sinesp", f"bancovde-{ano}.xlsx", URL.format(ano=ano), timeout=600, reaproveitar_dias=30 if antigo else None)
    cache = DIR_INTERIM / "mj_sinesp" / f"bancovde-{ano}-v3-{hashlib.sha256(bruto.conteudo).hexdigest()[:16]}.csv"
    if cache.exists():
        df = pd.read_csv(cache)
        return df[df["evento"].isin(eventos)].reset_index(drop=True), bruto
    eventos_pedidos, eventos = eventos, None  # agrega todos os eventos para o cache
    it = xlsx.linhas(bruto.conteudo)
    cab = [str(c).strip() if c else "" for c in next(it)]
    i_ev, i_dt = cab.index("evento"), cab.index("data_referencia")
    i_tot, i_vit = cab.index("total"), cab.index("total_vitima")
    i_uf = cab.index("uf")
    i_fem = cab.index("feminino")
    soma: dict[tuple, list[float]] = {}
    ufs: dict[tuple, set] = {}
    for r in it:
        if len(r) <= i_dt or not r[i_ev] or r[i_ev] == "evento":
            continue
        ref = r[i_dt]
        try:
            d = EXCEL_ZERO + dt.timedelta(days=int(float(ref)))
        except (TypeError, ValueError):
            d = pd.Timestamp(ref).date()
        chave = (r[i_ev], d.year, d.month)
        acc = soma.setdefault(chave, [0.0, 0.0, 0.0])
        acc[0] += _num(r[i_tot] if len(r) > i_tot else None)
        acc[1] += _num(r[i_vit] if len(r) > i_vit else None)
        acc[2] += _num(r[i_fem] if len(r) > i_fem else None)
        ufs.setdefault(chave, set()).add(r[i_uf])
    df = pd.DataFrame(
        [
            {"evento": k[0], "ano": k[1], "mes": k[2], "total": v[0], "total_vitima": v[1], "vitimas_mulheres": v[2], "n_ufs": len(ufs[k])}
            for k, v in soma.items()
        ]
    )
    cache.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(cache, index=False)
    return df[df["evento"].isin(eventos_pedidos)].reset_index(drop=True), bruto
