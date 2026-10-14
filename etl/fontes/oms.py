"""OMS: Global Health Observatory (API OData). Coberturas vacinais estimadas
pela OMS e pelo UNICEF (WUENIC), revistas a cada julho com a série inteira."""
from __future__ import annotations

import json

import pandas as pd

from etl.comum import Bruto, obter

URL = "https://ghoapi.azureedge.net/api/{codigo}"
URL_PAGINA = "https://www.who.int/teams/immunization-vaccines-and-biologicals/immunization-analysis-and-insights/global-monitoring/immunization-coverage/who-unicef-estimates-of-national-immunization-coverage"


def serie_pais(codigo: str, pais: str = "BRA") -> tuple[pd.DataFrame, Bruto, str]:
    """Série anual (ano, valor) de um indicador do GHO para um país, e a data da revisão."""
    bruto = obter("oms_gho", f"{codigo}_{pais}.json", URL.format(codigo=codigo), params={"$filter": f"SpatialDim eq '{pais}'"})
    itens = json.loads(bruto.conteudo)["value"]
    df = pd.DataFrame(
        [{"ano": int(x["TimeDim"]), "valor": float(x["NumericValue"])} for x in itens if x.get("NumericValue") is not None]
    ).sort_values("ano")
    revisao = max((x.get("Date") or "")[:10] for x in itens)
    return df.reset_index(drop=True), bruto, revisao
