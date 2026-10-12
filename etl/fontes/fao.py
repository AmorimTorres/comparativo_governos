"""FAO/FAOSTAT: indicadores de segurança alimentar (base dos relatórios SOFI).

Usa o arquivo em lote do domínio Food Security. A FAO revisa a série inteira a
cada edição, por isso guardamos a data de atualização do arquivo (vintage).
"""
from __future__ import annotations

import io
import zipfile

import pandas as pd

from etl.comum import Bruto, obter

URL = "https://bulks-faostat.fao.org/production/Food_Security_Data_E_All_Data_(Normalized).zip"
URL_PAGINA = "https://www.fao.org/faostat/en/#data/FS"
CODIGO_BRASIL = 21


def seguranca_alimentar_brasil() -> tuple[pd.DataFrame, Bruto]:
    bruto = obter("fao_faostat", "Food_Security_Data_E_All_Data_(Normalized).zip", URL, timeout=600)
    z = zipfile.ZipFile(io.BytesIO(bruto.conteudo))
    df = pd.read_csv(z.open("Food_Security_Data_E_All_Data_(Normalized).csv"), encoding="latin1", dtype=str)
    df = df[df["Area Code"] == str(CODIGO_BRASIL)].copy()
    return df, bruto
