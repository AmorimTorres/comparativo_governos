"""Orquestrador do pipeline: coleta -> brutos -> séries tratadas -> resumos -> validação.

Uso:
    python -m etl.run                 # coleta tudo (reaproveita brutos do dia)
    python -m etl.run --only desemprego,ipca_mensal
    ETL_OFFLINE=1 python -m etl.run   # refaz a partir dos brutos salvos, sem rede
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import traceback

import pandas as pd

from etl.comum import DIR_PROCESSED, hoje, ler_yaml
from etl.indicadores import REGISTRO
from etl.transforma.atribuicao import atribuir, carregar_governos
from etl.transforma.resumos import resumir
from etl.valida.checks import verificar

COLUNAS_SERIES = [
    "indicator_id", "periodo", "data_inicio", "data_fim", "valor", "unidade", "uf", "governo",
    "mes_do_mandato", "ano_do_mandato", "parcial", "coletado_em", "fonte_url", "observacao",
    "qualificador", "entra_no_resumo",
]

COLUNAS_CATALOGO = [
    "indicator_id", "tema", "nome", "descricao_curta", "unidade", "periodicidade", "sentido_desejavel",
    "fonte_orgao", "fonte_tabela_ou_serie", "url_fonte", "url_api", "metodologia_resumo", "ressalvas",
    "quebra_metodologica", "nivel_geografico",
    # extras
    "grupo", "camada", "ordem", "regra_atribuicao", "acumulado", "metrica_padrao", "casas_decimais",
    "ultimo_periodo", "coletado_em",
]

COLUNAS_EVENTOS = ["data_inicio", "data_fim", "evento", "categoria", "indicadores_afetados", "fonte_url", "descricao", "exibir_no_grafico"]


def processar(iid: str, cat: dict) -> pd.DataFrame:
    df = REGISTRO[iid]()
    df = df.copy()
    df["data_inicio"] = pd.to_datetime(df["data_inicio"]).dt.date
    df["data_fim"] = pd.to_datetime(df["data_fim"]).dt.date
    inicio = pd.Timestamp(cat.get("inicio_serie", "2012-01-01")).date()
    limite = pd.Timestamp(hoje()).date()
    df = df[(df["data_fim"] >= inicio) & (df["data_inicio"] <= limite)]
    df = df.dropna(subset=["valor"])
    df = atribuir(df, cat["periodicidade"], cat.get("regra_atribuicao", "centro"))
    df["observacao"] = [
        "; ".join(x for x in (t, o) if x) for t, o in zip(df["nota_transicao"], df["observacao"].fillna(""))
    ]
    df["indicator_id"] = iid
    df["unidade"] = cat["unidade"]
    df["uf"] = "BR"
    df["valor"] = df["valor"].astype(float).round(6)
    df["parcial"] = df["parcial"].astype(bool)
    df["entra_no_resumo"] = df["entra_no_resumo"].astype(bool)
    return df[COLUNAS_SERIES].sort_values("data_inicio").reset_index(drop=True)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="lista de indicator_id separados por vírgula")
    ap.add_argument("--sem-validar", action="store_true")
    args = ap.parse_args(argv)

    cfg = ler_yaml("indicadores.yaml")
    catalogo = {i["indicator_id"]: i for i in cfg["indicadores"]}
    faltando = set(catalogo) - set(REGISTRO)
    if faltando:
        print(f"Indicadores sem função de coleta: {sorted(faltando)}", file=sys.stderr)
        return 2
    alvo = args.only.split(",") if args.only else list(catalogo)

    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)
    caminho_series = DIR_PROCESSED / "series.csv"
    anteriores = pd.read_csv(caminho_series, dtype=str) if (args.only and caminho_series.exists()) else None

    partes, falhas = [], {}
    for iid in alvo:
        t0 = dt.datetime.now()
        try:
            df = processar(iid, catalogo[iid])
            partes.append(df)
            print(f"ok  {iid:32s} {len(df):5d} linhas  último {df['periodo'].iloc[-1]:>10s}  ({(dt.datetime.now() - t0).seconds}s)")
        except Exception as e:  # noqa: BLE001
            falhas[iid] = f"{type(e).__name__}: {e}"
            print(f"ERRO {iid}: {falhas[iid]}", file=sys.stderr)
            traceback.print_exc()

    series = pd.concat(partes, ignore_index=True) if partes else pd.DataFrame(columns=COLUNAS_SERIES)
    if anteriores is not None:
        # Execução parcial: mantém os demais indicadores do arquivo existente.
        anteriores = anteriores[~anteriores["indicator_id"].isin(series["indicator_id"].unique())]
        for c in ("valor",):
            anteriores[c] = anteriores[c].astype(float)
        for c in ("parcial", "entra_no_resumo"):
            anteriores[c] = anteriores[c].map({"True": True, "False": False})
        for c in ("mes_do_mandato", "ano_do_mandato"):
            anteriores[c] = pd.to_numeric(anteriores[c]).astype("Int64")
        anteriores["qualificador"] = anteriores["qualificador"].fillna("")
        anteriores["observacao"] = anteriores["observacao"].fillna("")
        series = pd.concat([anteriores, series], ignore_index=True)
    series = series.sort_values(["indicator_id", "data_inicio"]).reset_index(drop=True)

    governos = carregar_governos()
    gcfg = ler_yaml("governos.yaml")
    comparados = gcfg["comparacao_padrao"]
    cat_presentes = {k: v for k, v in catalogo.items() if k in set(series["indicator_id"])}
    resumos = resumir(series.assign(data_inicio=series["data_inicio"].astype(str)), cat_presentes, governos, comparados)

    # Catálogo com último período e data de coleta de cada indicador.
    linhas_cat = []
    for iid, cat in catalogo.items():
        s = series[series["indicator_id"] == iid]
        linha = {c: cat.get(c, "") for c in COLUNAS_CATALOGO}
        linha["ultimo_periodo"] = s["periodo"].iloc[-1] if not s.empty else ""
        linha["coletado_em"] = s["coletado_em"].max() if not s.empty else ""
        linhas_cat.append(linha)
    catalogo_df = pd.DataFrame(linhas_cat)[COLUNAS_CATALOGO].sort_values(["ordem", "indicator_id"])

    eventos = ler_yaml("eventos.yaml").get("eventos", []) if (DIR_PROCESSED.parent.parent / "etl" / "config" / "eventos.yaml").exists() else []
    eventos_df = pd.DataFrame(
        [
            {**{c: (";".join(e[c]) if isinstance(e.get(c), list) else e.get(c, "")) for c in COLUNAS_EVENTOS}, "exibir_no_grafico": bool(e.get("exibir_no_grafico", True))}
            for e in eventos
        ],
        columns=COLUNAS_EVENTOS,
    )

    problemas = [] if args.sem_validar else verificar(series, cat_presentes, resumos)

    series.to_csv(caminho_series, index=False)
    resumos.to_csv(DIR_PROCESSED / "resumos_por_governo.csv", index=False)
    catalogo_df.to_csv(DIR_PROCESSED / "catalogo_indicadores.csv", index=False)
    eventos_df.to_csv(DIR_PROCESSED / "eventos_contexto.csv", index=False)
    (DIR_PROCESSED / "governos.json").write_text(
        json.dumps(
            {"governos": [{**g, "inicio": str(g["inicio"]), "fim": str(g["fim"])} for g in gcfg["governos"]], "comparacao_padrao": comparados},
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )
    relatorio = {
        "executado_em": dt.datetime.now().isoformat(timespec="seconds"),
        "data_coleta": hoje(),
        "indicadores_ok": sorted(set(series["indicator_id"])),
        "falhas": falhas,
        "problemas_validacao": problemas,
    }
    (DIR_PROCESSED / "relatorio_execucao.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8")

    if problemas:
        print("\nPROBLEMAS DE VALIDAÇÃO:", file=sys.stderr)
        for p in problemas:
            print(" -", p, file=sys.stderr)
    if falhas or problemas:
        return 1
    print(f"\n{len(series)} linhas em series.csv; {len(resumos)} resumos; {len(eventos_df)} eventos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
