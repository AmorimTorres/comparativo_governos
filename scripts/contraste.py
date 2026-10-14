"""Valida o contraste WCAG dos pares de cores usados no painel (design/tokens.json).

Uso: python scripts/contraste.py   (sai com código 1 se algum par reprovar)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

TOKENS = Path(__file__).resolve().parent.parent / "design" / "tokens.json"

# (texto/primeiro plano, fundo, mínimo exigido, uso)
PARES = [
    ("identidade.azul_marinho", "identidade.amarelo", 4.5, "número e título no losango"),
    ("identidade.branco", "identidade.verde_escuro", 4.5, "texto branco pequeno sobre verde"),
    ("identidade.branco", "identidade.verde", 3.0, "texto branco grande (>= 24px) sobre verde da arte"),
    ("identidade.amarelo", "identidade.verde", 3.0, "display amarelo grande sobre verde"),
    ("identidade.amarelo", "identidade.verde_vivo", 3.0, "display amarelo grande sobre o verde do herói"),
    ("identidade.branco", "identidade.verde_vivo", 3.0, "texto branco grande sobre o verde do herói"),
    ("identidade.azul_marinho", "identidade.amarelo", 4.5, "metade amarela do duelo e botões amarelos"),
    ("identidade.branco", "identidade.azul_marinho", 4.5, "barra de fonte"),
    ("identidade.amarelo", "identidade.azul_marinho", 4.5, "rótulo amarelo na barra de fonte"),
    ("dados.governo_a", "superficie.off_white", 4.5, "linha e rótulo do governo A"),
    ("dados.governo_b", "superficie.off_white", 4.5, "linha e rótulo do governo B"),
    ("dados.governo_a", "superficie.painel", 4.5, "governo A sobre painel branco"),
    ("dados.governo_b", "superficie.painel", 4.5, "governo B sobre painel branco"),
    ("texto.principal", "superficie.off_white", 4.5, "texto corrido"),
    ("texto.secundario", "superficie.off_white", 4.5, "texto secundário"),
    ("dados.governo_b", "dados.governo_a", 1.5, "distinção mínima de luminância entre governos (além de traço e marcador)"),
]


def _lum(h: str) -> float:
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def razao(a: str, b: str) -> float:
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def cor(tokens: dict, caminho: str) -> str:
    grupo, nome = caminho.split(".")
    return tokens["cor"][grupo][nome]["valor"]


def verificar() -> list[str]:
    tokens = json.loads(TOKENS.read_text(encoding="utf-8"))
    falhas = []
    for a, b, minimo, uso in PARES:
        r = razao(cor(tokens, a), cor(tokens, b))
        status = "ok " if r >= minimo else "FALHA"
        print(f"{status} {r:5.2f}:1 (mín. {minimo}) {a} sobre {b} — {uso}")
        if r < minimo:
            falhas.append(f"{a}/{b}: {r:.2f} < {minimo}")
    return falhas


if __name__ == "__main__":
    sys.exit(1 if verificar() else 0)
