"""Compara data/processed/series.csv com a versão do último commit e escreve
um resumo em Markdown (usado no corpo do PR de atualização de dados).

Destaca novos períodos e, principalmente, revisões de valores já publicados,
que merecem revisão humana antes do merge.
"""
from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
ARQ = "data/processed/series.csv"


def anterior() -> pd.DataFrame | None:
    r = subprocess.run(["git", "show", f"HEAD:{ARQ}"], cwd=RAIZ, capture_output=True)
    if r.returncode != 0:
        return None
    return pd.read_csv(io.BytesIO(r.stdout), dtype={"periodo": str})


def main() -> int:
    novo = pd.read_csv(RAIZ / ARQ, dtype={"periodo": str})
    velho = anterior()
    rel = json.loads((RAIZ / "data/processed/relatorio_execucao.json").read_text(encoding="utf-8"))
    print(f"## Atualização de dados\n\nColeta em {rel.get('data_coleta')}. Validações: "
          f"{'sem problemas' if not rel.get('problemas_validacao') else 'COM PROBLEMAS'}.\n")
    if rel.get("falhas"):
        print("### Falhas de coleta\n")
        for k, v in rel["falhas"].items():
            print(f"- `{k}`: {v}")
        print()
    if velho is None:
        print("Primeira versão dos dados (sem comparação).")
        return 0
    chave = ["indicator_id", "periodo"]
    m = novo.merge(velho, on=chave, how="outer", suffixes=("", "_ant"), indicator=True)
    novos = m[m["_merge"] == "left_only"]
    removidos = m[m["_merge"] == "right_only"]
    ambos = m[m["_merge"] == "both"]
    revisados = ambos[(ambos["valor"] - ambos["valor_ant"]).abs() > 1e-9]
    print("### Novos períodos\n")
    if novos.empty:
        print("Nenhum.\n")
    for iid, g in novos.groupby("indicator_id"):
        print(f"- `{iid}`: {', '.join(g['periodo'].tolist()[:12])}")
    print("\n### Valores revisados pela fonte (conferir)\n")
    if revisados.empty:
        print("Nenhum.\n")
    for iid, g in revisados.groupby("indicator_id"):
        ex = "; ".join(f"{p}: {a:g} → {b:g}" for p, a, b in zip(g["periodo"], g["valor_ant"], g["valor"]))
        print(f"- `{iid}` ({len(g)}): {ex[:400]}")
    if not removidos.empty:
        print("\n### Períodos removidos (conferir)\n")
        for iid, g in removidos.groupby("indicator_id"):
            print(f"- `{iid}`: {', '.join(g['periodo'].tolist()[:12])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
