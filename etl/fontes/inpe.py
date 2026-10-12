"""INPE: PRODES (TerraBrasilis), DETER (WFS) e focos de queimadas (BDQueimadas)."""
from __future__ import annotations

import datetime as dt
import io
import re
import zipfile

import pandas as pd

from etl.comum import Bruto, obter

TB = "https://terrabrasilis.dpi.inpe.br"
DASH = TB + "/app/dashboard/deforestation/biomes/legal_amazon/rates"
FILES = TB + "/app/prodes/dashboard/deforestation/files/"
WFS = TB + "/geoserver/ows"
QUEIMADAS = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/"


def _arquivo_taxas() -> str:
    """Descobre o nome do JSON de taxas (muda a cada ano, ex.: rates2025.json)
    lendo a constante FILE_RATES no bundle do dashboard."""
    html = obter("inpe_prodes", "dashboard_rates.html", DASH).texto()
    app = re.search(r'(app\.[0-9a-f]+\.js)', html)
    if not app:
        raise RuntimeError("Não achei o bundle app.*.js do dashboard PRODES")
    js = obter("inpe_prodes", app.group(1), TB + "/app/dashboard/deforestation/" + app.group(1)).texto()
    m = re.search(r'"FILE_RATES".{0,200}?"(rates\d{4}\.json)"', js, re.S)
    if not m:
        raise RuntimeError("Não achei FILE_RATES no bundle do dashboard PRODES")
    return m.group(1)


def prodes_taxas_amazonia() -> tuple[pd.DataFrame, Bruto]:
    """Taxa anual oficial de desmatamento da Amazônia Legal (km²), soma das UFs."""
    nome = _arquivo_taxas()
    bruto = obter("inpe_prodes", nome, FILES + nome)
    d = bruto.json()
    linhas = []
    for p in d["periods"]:
        ini = dt.date(p["startDate"]["year"], p["startDate"]["month"], p["startDate"]["day"])
        fim = dt.date(p["endDate"]["year"], p["endDate"]["month"], p["endDate"]["day"])
        area = sum(a["area"] for f in p["features"] for a in f["areas"])
        linhas.append({"ano_prodes": fim.year, "data_inicio": ini, "data_fim": fim, "valor": float(area)})
    return pd.DataFrame(linhas), bruto


def prodes_incrementos(bioma: str) -> tuple[pd.DataFrame, Bruto]:
    """Incrementos anuais mapeados de desmatamento (km²) de um bioma
    (ex.: 'cerrado'). Usa o nível de agregação loi=1 (estados)."""
    bruto = obter("inpe_prodes", f"prodes_{bioma}.json", FILES + f"data/prodes_{bioma}.json")
    d = bruto.json()
    linhas = []
    for p in d["periods"]:
        ini = dt.date(p["startDate"]["year"], p["startDate"]["month"], p["startDate"]["day"])
        fim = dt.date(p["endDate"]["year"], p["endDate"]["month"], p["endDate"]["day"])
        area = sum(a["area"] for f in p["features"] if f["loi"] == 1 for a in f["areas"])
        linhas.append({"ano_prodes": fim.year, "data_inicio": ini, "data_fim": fim, "valor": float(area)})
    return pd.DataFrame(linhas), bruto


CLASSES_DESMATAMENTO_DETER = ("DESMATAMENTO_CR", "DESMATAMENTO_VEG", "MINERACAO")


def deter_data_atualizacao() -> str:
    p = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": "deter-amz:updated_date", "outputFormat": "application/json"}
    b = obter("inpe_deter", "updated_date.json", WFS, params=p)
    return b.json()["features"][0]["properties"]["updated_date"]


def deter_mes(ano: int, mes: int) -> tuple[dict, Bruto]:
    """Área (km²) de alertas DETER na Amazônia Legal por classe, num mês
    (data de detecção view_date). Baixa só atributos, sem geometria."""
    ini = dt.date(ano, mes, 1)
    fim = dt.date(ano + (mes == 12), mes % 12 + 1, 1)
    p = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": "deter-amz:deter_amz", "outputFormat": "application/json",
        "propertyName": "classname,view_date,areamunkm",
        "CQL_FILTER": f"view_date >= '{ini.isoformat()}' AND view_date < '{fim.isoformat()}'",
    }
    # Meses com mais de 3 meses de idade raramente mudam: reaproveita cópia de até 90 dias.
    antigo = (dt.date.today() - fim).days > 90
    b = obter("inpe_deter", f"deter_amz_{ano}{mes:02d}.json", WFS, params=p, timeout=300, reaproveitar_dias=90 if antigo else None)
    soma: dict[str, float] = {}
    for f in b.json()["features"]:
        pr = f["properties"]
        soma[pr["classname"]] = soma.get(pr["classname"], 0.0) + float(pr.get("areamunkm") or 0)
    return soma, b


def focos_ano_referencia(ano: int) -> tuple[pd.Series, Bruto]:
    """Focos do satélite de referência no Brasil, por mês, a partir do arquivo
    anual oficial (focos_br_ref_AAAA.zip)."""
    url = f"{QUEIMADAS}anual/Brasil_sat_ref/focos_br_ref_{ano}.zip"
    antigo = ano < dt.date.today().year - 1  # anos fechados há mais de um ano
    b = obter("inpe_queimadas", f"focos_br_ref_{ano}.zip", url, timeout=600, reaproveitar_dias=180 if antigo else None)
    z = zipfile.ZipFile(io.BytesIO(b.conteudo))
    csv = next(n for n in z.namelist() if n.endswith(".csv"))
    df = pd.read_csv(z.open(csv), usecols=["data_pas"], dtype=str)
    meses = pd.to_datetime(df["data_pas"].str[:7], format="%Y-%m")
    return meses.value_counts().sort_index(), b


SATELITE_REFERENCIA = "AQUA_M-T"


def focos_mes_todos(ano: int, mes: int) -> tuple[int, Bruto]:
    """Focos do satélite de referência num mês, a partir do arquivo mensal com
    todos os satélites (usado no ano corrente, antes do arquivo anual)."""
    url = f"{QUEIMADAS}mensal/Brasil/focos_mensal_br_{ano}{mes:02d}.csv"
    fim_mes = dt.date(ano + (mes == 12), mes % 12 + 1, 1)
    fechado = (dt.date.today() - fim_mes).days > 60  # mês encerrado há mais de 2 meses
    b = obter("inpe_queimadas", f"focos_mensal_br_{ano}{mes:02d}.csv", url, timeout=600, reaproveitar_dias=3650 if fechado else None)
    df = pd.read_csv(io.BytesIO(b.conteudo), usecols=["satelite"], dtype=str)
    return int((df["satelite"].str.strip() == SATELITE_REFERENCIA).sum()), b
