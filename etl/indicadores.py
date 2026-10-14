"""Montagem das séries de cada indicador a partir das fontes.

Cada função registrada com @indicador('id') devolve um DataFrame com:
    periodo, data_inicio, data_fim, valor, qualificador, parcial,
    observacao, fonte_url, entra_no_resumo, coletado_em
A atribuição a governos, o corte de datas e os resumos ficam em run.py.

Nenhum valor é digitado à mão: tudo vem de download registrado no manifesto.
"""
from __future__ import annotations

import datetime as dt
import re
from typing import Callable

import pandas as pd

from etl.comum import NaoEncontrado, hoje
from etl.fontes import anp, bcb, fao, ibge_ftp, inep, inpe, ipeadata, mds, oms, siconfi, sidra, sinesp, tabnet
from etl.transforma.deflacao import deflacionar, indice_mensal

REGISTRO: dict[str, Callable[[], pd.DataFrame]] = {}

COLUNAS = [
    "periodo", "data_inicio", "data_fim", "valor", "qualificador", "parcial",
    "observacao", "fonte_url", "entra_no_resumo", "coletado_em",
]


def indicador(indicator_id: str):
    def deco(fn):
        REGISTRO[indicator_id] = fn
        return fn
    return deco


# ------------------------------------------------------------------ helpers

def _fim_mes(d: dt.date) -> dt.date:
    return (pd.Timestamp(d) + pd.offsets.MonthEnd(0)).date()


def _inicio_mes(d) -> dt.date:
    t = pd.Timestamp(d)
    return dt.date(t.year, t.month, 1)


def _somar_meses(d: dt.date, n: int) -> dt.date:
    t = pd.Timestamp(d) + pd.DateOffset(months=n)
    return dt.date(t.year, t.month, 1)


def _base(df: pd.DataFrame, fonte_url: str, coletado_em: str) -> pd.DataFrame:
    df = df.copy()
    for c, v in [("qualificador", ""), ("parcial", False), ("observacao", ""), ("entra_no_resumo", True)]:
        if c not in df.columns:
            df[c] = v
        else:
            # Linhas montadas sem a chave ficam vazias: aplica o padrão.
            df[c] = df[c].astype(object).where(df[c].notna(), v)
    df["fonte_url"] = fonte_url
    df["coletado_em"] = coletado_em
    return df[COLUNAS]


def _mensal(datas, valores, fonte_url, coletado_em, janela_meses: int = 1) -> pd.DataFrame:
    """Linhas mensais. janela_meses > 1 marca o período coberto (ex.: 12 para
    acumulados em 12 meses; 3 para trimestre móvel), identificado pelo mês final."""
    linhas = []
    for d, v in zip(pd.to_datetime(datas), valores):
        fim = _fim_mes(d.date())
        ini = _somar_meses(_inicio_mes(d), -(janela_meses - 1))
        linhas.append({"periodo": d.strftime("%Y-%m"), "data_inicio": ini, "data_fim": fim, "valor": v})
    return _base(pd.DataFrame(linhas), fonte_url, coletado_em)


def _trimestral(codigos, valores, fonte_url, coletado_em) -> pd.DataFrame:
    """Códigos SIDRA AAAATT (TT = 01..04)."""
    linhas = []
    for c, v in zip(codigos, valores):
        ano, tri = int(c[:4]), int(c[4:])
        ini = dt.date(ano, 3 * (tri - 1) + 1, 1)
        linhas.append({"periodo": f"{ano}T{tri}", "data_inicio": ini, "data_fim": _fim_mes(_somar_meses(ini, 2)), "valor": v})
    return _base(pd.DataFrame(linhas), fonte_url, coletado_em)


def _anual(anos, valores, fonte_url, coletado_em) -> pd.DataFrame:
    linhas = [
        {"periodo": str(a), "data_inicio": dt.date(int(a), 1, 1), "data_fim": dt.date(int(a), 12, 31), "valor": v}
        for a, v in zip(anos, valores)
    ]
    return _base(pd.DataFrame(linhas), fonte_url, coletado_em)


def _sidra_mensal(tabela, var, classif=None, janela=1):
    df, b = sidra.consultar(tabela, var, "all", classif)
    df = df.dropna(subset=["valor"])
    datas = pd.to_datetime(df["periodo_codigo"], format="%Y%m")
    return _mensal(datas, df["valor"], b.url, b.coletado_em, janela)


def _bcb_mensal(codigo, inicio="2012-01-01"):
    df, bs = bcb.serie(codigo, inicio)
    df = df.dropna(subset=["valor"])
    df = df[df["data"] <= pd.Timestamp(hoje())]
    return _mensal(df["data"], df["valor"], bcb.url_serie(codigo), bs[-1].coletado_em)


# ------------------------------------------------------------------ economia

@indicador("desemprego")
def desemprego():
    return _sidra_mensal(6381, "4099", janela=3)


@indicador("pib_anual")
def pib_anual():
    df, b = sidra.consultar(5932, "6563", "all", {11255: "90707"})
    df = df.dropna(subset=["valor"])
    df["ano"] = df["periodo_codigo"].str[:4].astype(int)
    df["tri"] = df["periodo_codigo"].str[4:].astype(int)
    linhas = []
    for ano, g in df.groupby("ano"):
        ult = g.sort_values("tri").iloc[-1]
        completo = int(ult["tri"]) == 4
        fim = _fim_mes(dt.date(ano, 3 * int(ult["tri"]), 1))
        linhas.append({
            "periodo": str(ano), "data_inicio": dt.date(ano, 1, 1), "data_fim": fim, "valor": ult["valor"],
            "parcial": not completo, "entra_no_resumo": completo,
            "observacao": "" if completo else f"acumulado no ano até o {int(ult['tri'])}º trimestre (ano incompleto)",
        })
    return _base(pd.DataFrame(linhas), b.url, b.coletado_em)


@indicador("pib_trimestral")
def pib_trimestral():
    df, b = sidra.consultar(5932, "6564", "all", {11255: "90707"})
    df = df.dropna(subset=["valor"])
    return _trimestral(df["periodo_codigo"], df["valor"], b.url, b.coletado_em)


@indicador("rendimento_real")
def rendimento_real():
    # Tabela mensal (trimestre móvel): a trimestral 5436 não tem 2020T2–2022T1.
    df, b = sidra.consultar(6390, "5933", "all")
    df = df.dropna(subset=["valor"])
    ult = df["periodo_nome"].iloc[-1]
    out = _mensal(pd.to_datetime(df["periodo_codigo"], format="%Y%m"), df["valor"], b.url, b.coletado_em, janela_meses=3)
    out["observacao"] = f"valores a preços de {ult}"
    return out


@indicador("informalidade")
def informalidade():
    df, b = sidra.consultar(8529, "12466", "all")
    df = df.dropna(subset=["valor"])
    return _trimestral(df["periodo_codigo"], df["valor"], b.url, b.coletado_em)


@indicador("caged_saldo")
def caged_saldo():
    df, b = ipeadata.serie("CAGED12_SALDON12")
    df = df.dropna(subset=["valor"])
    return _mensal(df["data"], df["valor"], b.url, b.coletado_em)


@indicador("salario_minimo_real")
def salario_minimo_real():
    df, bs = bcb.serie(1619, "2012-01-01")
    df = df[df["data"] <= pd.Timestamp(hoje())].dropna(subset=["valor"])
    reais, base = deflacionar(df["valor"], df["data"], "INPC")
    df = df.assign(real=reais).dropna(subset=["real"])
    out = _mensal(df["data"], df["real"], bcb.url_serie(1619), bs[-1].coletado_em)
    out["observacao"] = [f"nominal R$ {v:,.2f}; reais de {base} pelo INPC".replace(",", "X").replace(".", ",").replace("X", ".") for v in df["valor"]]
    return out


# ------------------------------------------------------------- custo de vida

@indicador("ipca_mensal")
def ipca_mensal():
    return _sidra_mensal(1737, "63")


@indicador("ipca_12m")
def ipca_12m():
    return _sidra_mensal(1737, "2265", janela=12)


@indicador("ipca_alimentos")
def ipca_alimentos():
    a = _sidra_mensal(1419, "63", {315: "7170"})
    b = _sidra_mensal(7060, "63", {315: "7170"})
    a = a[a["periodo"] < "2020-01"]
    a["observacao"] = "SIDRA 1419 (pesos POF 2008–2009)"
    b["observacao"] = "SIDRA 7060 (pesos POF 2017–2018)"
    return pd.concat([a, b], ignore_index=True)


def _anp_produto(produto: str):
    df, b = anp.mensal_brasil()
    df = df[df["produto"] == produto].dropna(subset=["preco"]).sort_values("mes")
    reais, base = deflacionar(df["preco"], df["mes"], "IPCA")
    df = df.assign(real=reais).dropna(subset=["real"])
    out = _mensal(df["mes"], df["real"], anp.URL_MENSAL_BRASIL, b.coletado_em)
    out["observacao"] = [f"nominal R$ {v:.2f}; reais de {base} pelo IPCA".replace(".", ",") for v in df["preco"]]
    return out


@indicador("gasolina_real")
def gasolina_real():
    return _anp_produto("GASOLINA COMUM")


@indicador("glp_real")
def glp_real():
    return _anp_produto("GLP")


@indicador("diesel_real")
def diesel_real():
    return _anp_produto("OLEO DIESEL")


# -------------------------------------------------------- pobreza e fome

@indicador("extrema_pobreza")
def extrema_pobreza():
    df, b = ibge_ftp.sis_pobreza()
    return _anual(df["ano"], df["extrema_pobreza"], b.url, b.coletado_em)


@indicador("pobreza")
def pobreza():
    df, b = ibge_ftp.sis_pobreza()
    return _anual(df["ano"], df["pobreza"], b.url, b.coletado_em)


@indicador("gini")
def gini():
    df, b = sidra.consultar(7435, "10681", "all")
    df = df.dropna(subset=["valor"])
    return _anual(df["periodo_codigo"], df["valor"], b.url, b.coletado_em)


def _fao(item: str):
    df, b = fao.seguranca_alimentar_brasil()
    import io
    import zipfile

    vintage = dt.date(*zipfile.ZipFile(io.BytesIO(b.conteudo)).infolist()[0].date_time[:3]).isoformat()
    df = df[(df["Item"] == item) & (df["Element"] == "Value")]
    linhas = []
    for anos, v in zip(df["Year"], df["Value"]):
        a1, a2 = (int(x) for x in anos.split("-"))
        txt = str(v).strip()
        qual = "<" if txt.startswith("<") else ""
        num = float(txt.lstrip("<")) if txt not in ("", "nan") else float("nan")
        linhas.append({
            "periodo": anos, "data_inicio": dt.date(a1, 1, 1), "data_fim": dt.date(a2, 12, 31),
            "valor": num, "qualificador": qual,
            "observacao": (f"menor que {txt.lstrip('<').replace('.', ',')}% (a FAO não publica valor exato); " if qual else "")
            + f"média trienal; edição FAOSTAT de {vintage}",
        })
    out = _base(pd.DataFrame(linhas), fao.URL, b.coletado_em)
    return out.dropna(subset=["valor"])


@indicador("subalimentacao_fao")
def subalimentacao_fao():
    return _fao("Prevalence of undernourishment (percent) (3-year average)")


@indicador("inseguranca_grave_fao")
def inseguranca_grave_fao():
    return _fao("Prevalence of severe food insecurity in the total population (percent) (3-year average)")


def _mds_programa():
    """Famílias e valor repassado por mês, juntando Bolsa Família e Auxílio Brasil."""
    pbf_f, b1 = mds.soma_mensal("qtd_familias_beneficiarias_bolsa_familia_i")
    pab_f, _ = mds.soma_mensal("pab_qtd_fam_benef_i")
    pbf_v, _ = mds.soma_mensal("valor_repassado_bolsa_familia_f")
    pab_v, _ = mds.soma_mensal("pab_valor_pago_d")
    def s(df):
        return df.set_index("data")["soma"].fillna(0) if not df.empty else pd.Series(dtype=float)
    t = pd.DataFrame({"pbf_f": s(pbf_f), "pab_f": s(pab_f), "pbf_v": s(pbf_v), "pab_v": s(pab_v)}).fillna(0)
    t["programa"] = ["Auxílio Brasil" if r.pab_f > 0 and r.pbf_f == 0 else "Bolsa Família" for r in t.itertuples()]
    t["familias"] = t["pbf_f"] + t["pab_f"]
    t["valor"] = t["pbf_v"] + t["pab_v"]
    t = t[(t["familias"] > 0) & (t.index <= pd.Timestamp(hoje()))]
    return t, b1


@indicador("bolsa_familia_familias")
def bolsa_familia_familias():
    t, b = _mds_programa()
    out = _mensal(t.index, t["familias"], mds.BASE, b.coletado_em)
    out["observacao"] = list(t["programa"])
    return out


@indicador("bolsa_familia_beneficio_real")
def bolsa_familia_beneficio_real():
    t, b = _mds_programa()
    medio = t["valor"] / t["familias"]
    reais, base = deflacionar(medio, pd.Series(t.index), "IPCA")
    t = t.assign(medio=medio.to_numpy(), real=reais)
    t = t.dropna(subset=["real"])
    out = _mensal(t.index, t["real"], mds.BASE, b.coletado_em)
    # Meses em que o valor médio nominal cai a menos da metade da mediana de
    # 2019 são os meses em que as famílias receberam o Auxílio Emergencial no
    # lugar do benefício (critério baseado nos próprios dados).
    ref = t.loc[t.index.year == 2019, "medio"].median()
    ae = (t["medio"] < 0.5 * ref).to_numpy()
    out["entra_no_resumo"] = ~ae
    out["observacao"] = [
        (f"{p}; valor reduzido: famílias receberam o Auxílio Emergencial no lugar do benefício" if a else p)
        + f"; reais de {base} pelo IPCA"
        for p, a in zip(t["programa"], ae)
    ]
    return out


# --------------------------------------------------------- meio ambiente

@indicador("prodes_amazonia")
def prodes_amazonia():
    df, b = inpe.prodes_taxas_amazonia()
    out = _base(
        pd.DataFrame({
            "periodo": df["ano_prodes"].astype(str), "data_inicio": df["data_inicio"], "data_fim": df["data_fim"],
            "valor": df["valor"], "observacao": [f"ano PRODES: ago/{a - 1}–jul/{a}" for a in df["ano_prodes"]],
        }),
        b.url, b.coletado_em,
    )
    return out


@indicador("prodes_cerrado")
def prodes_cerrado():
    df, b = inpe.prodes_incrementos("cerrado")
    dur = (pd.to_datetime(df["data_fim"]) - pd.to_datetime(df["data_inicio"])).dt.days
    df = df[dur.between(360, 370)]
    return _base(
        pd.DataFrame({
            "periodo": df["ano_prodes"].astype(str), "data_inicio": df["data_inicio"], "data_fim": df["data_fim"],
            "valor": df["valor"], "observacao": [f"ano PRODES: ago/{a - 1}–jul/{a}" for a in df["ano_prodes"]],
        }),
        b.url, b.coletado_em,
    )


@indicador("deter_amazonia")
def deter_amazonia():
    atualizado = pd.Timestamp(inpe.deter_data_atualizacao()).date()
    mes = dt.date(2016, 8, 1)
    linhas, coleta = [], None
    while _fim_mes(mes) <= atualizado:
        soma, b = inpe.deter_mes(mes.year, mes.month)
        coleta = b.coletado_em
        v = sum(soma.get(c, 0.0) for c in inpe.CLASSES_DESMATAMENTO_DETER)
        linhas.append({"periodo": mes.strftime("%Y-%m"), "data_inicio": mes, "data_fim": _fim_mes(mes), "valor": round(v, 2)})
        mes = _somar_meses(mes, 1)
    out = _base(pd.DataFrame(linhas), inpe.WFS, coleta)
    out["observacao"] = f"DETER atualizado em {atualizado.isoformat()}"
    return out


@indicador("focos_queimadas")
def focos_queimadas():
    linhas, coleta = [], None
    ano = 2012
    ultimo_anual = None
    while True:
        try:
            s, b = inpe.focos_ano_referencia(ano)
        except NaoEncontrado:
            break
        coleta = b.coletado_em
        ultimo_anual = ano
        for m, v in s.items():
            linhas.append({"periodo": m.strftime("%Y-%m"), "data_inicio": m.date(), "data_fim": _fim_mes(m.date()), "valor": float(v),
                           "observacao": f"arquivo anual focos_br_ref_{ano}"})
        ano += 1
    # Ano corrente: arquivos mensais com todos os satélites, filtrando o de referência.
    hoje_d = pd.Timestamp(hoje()).date()
    mes = dt.date(ultimo_anual + 1, 1, 1)
    while mes <= hoje_d:
        try:
            n, b = inpe.focos_mes_todos(mes.year, mes.month)
        except NaoEncontrado:
            break
        incompleto = _fim_mes(mes) >= hoje_d
        linhas.append({"periodo": mes.strftime("%Y-%m"), "data_inicio": mes, "data_fim": _fim_mes(mes), "valor": float(n),
                       "parcial": incompleto, "entra_no_resumo": not incompleto,
                       "observacao": "arquivo mensal, satélite AQUA_M-T" + ("; mês em andamento" if incompleto else "")})
        mes = _somar_meses(mes, 1)
    return _base(pd.DataFrame(linhas), inpe.QUEIMADAS, coleta)


# ------------------------------------------------------------- saúde (SIM)

OBT = "sim/cnv/obt10br.def"
INF = "sim/cnv/inf10br.def"
NV = "sinasc/cnv/nvbr.def"


def _arquivos(prefixo: str, definicao: str, desde: int = 2012) -> list[str]:
    def ano(a):
        yy = int(a[-6:-4])
        return 1900 + yy if yy >= 90 else 2000 + yy

    disponiveis = [v for v, _ in tabnet.opcoes(definicao, "Arquivos")]
    return sorted(a for a in disponiveis if re.fullmatch(prefixo + r"\d{2}\.dbf", a) and ano(a) >= desde)


def _notas_prelim(bruto) -> tuple[int, str]:
    return tabnet.ultimo_ano_final(bruto), tabnet.nota_rodape(bruto)


def _obitos_mensais(selecoes: dict | None) -> tuple[pd.DataFrame, object]:
    arq = _arquivos("obtbr", OBT)
    df, b = tabnet.consultar(OBT, "Ano/mês_do_Óbito", "--Não-Ativa--", "Óbitos_p/Residênc", arq, selecoes)
    return tabnet.linhas_ano_mes(df), b


def _meses_incompletos(final: int) -> set[tuple[int, int]]:
    """Meses de anos não finais em que o total de óbitos (todas as causas) é
    menor que 85% do mesmo mês do último ano final: registro ainda incompleto."""
    tot, _ = _obitos_mensais(None)
    ref = {int(m): v for m, v in zip(tot[tot["ano"] == final]["mes"], tot[tot["ano"] == final]["valor"])}
    cand = tot[(tot["ano"] > final)]
    return {(int(a), int(m)) for a, m, v in zip(cand["ano"], cand["mes"], cand["valor"]) if v < 0.85 * ref.get(int(m), 0)}


def _anos_previa(bruto) -> set[int]:
    """Anos que a nota do TabNet classifica como prévia (ex.: "Dados de 2026 -
    2a prévia"): registro muito incompleto, fora das médias."""
    return {int(a) for a in re.findall(r"Dados de (\d{4}) - [^-]*pr[ée]via", tabnet.nota_rodape(bruto))}


def _homicidio_selecoes():
    return {"SGrupo_CID-10": tabnet.valores(OBT, "SGrupo_CID-10", ["Agressões", "Intervenções legais e operações de guerra"])}


def _mensal_sim(selecoes) -> pd.DataFrame:
    df, b = _obitos_mensais(selecoes)
    final, nota = _notas_prelim(b)
    incompletos = _meses_incompletos(final)
    previa = _anos_previa(b)
    datas = [dt.date(a, m, 1) for a, m in zip(df["ano"], df["mes"])]
    out = _mensal(datas, df["valor"], tabnet.BASE + "tabcgi.exe?" + OBT, b.coletado_em)
    prelim = [a > final for a in df["ano"]]
    em_previa = [a in previa for a in df["ano"]]
    inc = [(a, m) in incompletos for a, m in zip(df["ano"], df["mes"])]
    fora = [x or y for x, y in zip(em_previa, inc)]
    out["parcial"] = fora
    out["entra_no_resumo"] = [not x for x in fora]
    out["observacao"] = [
        ("prévia do SIM (registro incompleto)" if v else "dado preliminar" if p else "dado final")
        + ("; mês ainda incompleto no SIM" if i and not v else "")
        for p, v, i in zip(prelim, em_previa, inc)
    ]
    return out


@indicador("homicidios_mensal")
def homicidios_mensal():
    return _mensal_sim(_homicidio_selecoes())


@indicador("covid_obitos")
def covid_obitos():
    return _mensal_sim({"SCategoria_CID-10": tabnet.valores(OBT, "SCategoria_CID-10", ["B34 Doenças por vírus, de localização não especificada"])})


@indicador("homicidios_taxa")
def homicidios_taxa():
    arq = _arquivos("obtbr", OBT)
    df, b = tabnet.consultar(OBT, "Ano_do_Óbito", "--Não-Ativa--", "Óbitos_p/Residênc", arq, _homicidio_selecoes())
    final, _ = _notas_prelim(b)
    rot, col = df.columns[0], df.columns[1]
    df = df[df[rot].str.fullmatch(r"\d{4}")]
    df = df.assign(ano=df[rot].astype(int), obitos=df[col])
    ano_atual = pd.Timestamp(hoje()).year
    df = df[df["ano"] < ano_atual]  # ano em curso não tem 12 meses
    pop, bp = ibge_ftp.projecao_populacao_brasil()
    df = df.merge(pop, on="ano", how="left")
    df["taxa"] = df["obitos"] / df["populacao"] * 100_000
    out = _anual(df["ano"], df["taxa"].round(2), b.url, b.coletado_em)
    out["observacao"] = [
        f"{int(o):,} óbitos; população projetada {int(p):,}".replace(",", ".") + ("; dado preliminar" if a > final else "")
        for o, p, a in zip(df["obitos"], df["populacao"], df["ano"])
    ]
    return out


@indicador("homicidios_mulheres_taxa")
def homicidios_mulheres_taxa():
    sel = _homicidio_selecoes()
    sel["SSexo"] = tabnet.valores(OBT, "SSexo", ["Fem"])
    df, b = tabnet.consultar(OBT, "Ano_do_Óbito", "--Não-Ativa--", "Óbitos_p/Residênc", _arquivos("obtbr", OBT), sel)
    final, _ = _notas_prelim(b)
    rot, col = df.columns[0], df.columns[1]
    df = df[df[rot].str.fullmatch(r"\d{4}")]
    df = df.assign(ano=df[rot].astype(int), obitos=df[col])
    df = df[df["ano"] < pd.Timestamp(hoje()).year]  # ano em curso não tem 12 meses
    pop, _ = ibge_ftp.projecao_populacao_brasil()
    df = df.merge(pop, on="ano", how="left")
    df["taxa"] = df["obitos"] / df["populacao_mulheres"] * 100_000
    out = _anual(df["ano"], df["taxa"].round(2), b.url, b.coletado_em)
    out["observacao"] = [
        f"{int(o):,} óbitos de mulheres; população feminina projetada {int(p):,}".replace(",", ".") + ("; dado preliminar" if a > final else "")
        for o, p, a in zip(df["obitos"], df["populacao_mulheres"], df["ano"])
    ]
    return out


@indicador("mortalidade_infantil")
def mortalidade_infantil():
    ob, bo = tabnet.consultar(INF, "Ano_do_Óbito", "--Não-Ativa--", "Óbitos_p/Residênc", _arquivos("infbr", INF))
    nv, bn = tabnet.consultar(NV, "Ano_do_nascimento", "--Não-Ativa--", "Nascim_p/resid.mãe", _arquivos("nvbr", NV))
    fo, _ = _notas_prelim(bo)
    fn = tabnet.ultimo_ano_final(bn)

    def anual(df):
        rot, col = df.columns[0], df.columns[1]
        d = df[df[rot].str.fullmatch(r"\d{4}")]
        return pd.Series(d[col].to_numpy(), index=d[rot].astype(int))

    o, n = anual(ob), anual(nv)
    ano_atual = pd.Timestamp(hoje()).year
    anos = sorted(a for a in set(o.index) & set(n.index) if a < ano_atual)
    taxa = [round(o[a] / n[a] * 1000, 2) for a in anos]
    out = _anual(anos, taxa, bo.url, bo.coletado_em)
    out["observacao"] = [
        f"{int(o[a]):,} óbitos infantis; {int(n[a]):,} nascidos vivos".replace(",", ".")
        + ("; dado preliminar" if a > min(fo, fn) else "")
        for a in anos
    ]
    return out


# -------------------------------------------------------- segurança (Sinesp)

def _sinesp(evento: str, coluna: str):
    partes, coleta = [], None
    ano_atual = pd.Timestamp(hoje()).year
    for ano in range(2015, ano_atual + 1):
        try:
            df, b = sinesp.mensal_brasil(ano, {evento})
        except NaoEncontrado:
            continue
        coleta = b.coletado_em
        partes.append(df)
    df = pd.concat(partes, ignore_index=True).sort_values(["ano", "mes"])
    df = df[df["ano"] >= 2015]
    datas = [dt.date(int(a), int(m), 1) for a, m in zip(df["ano"], df["mes"])]
    out = _mensal(datas, df[coluna], sinesp.URL.format(ano="AAAA"), coleta)
    # Mês com menos UFs informando que o normal = registro incompleto.
    if "n_ufs" in df.columns:
        completo = df["n_ufs"].to_numpy() >= 27
        out["parcial"] = ~completo
        out["entra_no_resumo"] = completo
        out["observacao"] = [f"{int(n)} UFs informaram" for n in df["n_ufs"]]
    return out


@indicador("feminicidios")
def feminicidios():
    return _sinesp("Feminicídio", "total_vitima")


def _sinesp_mulheres() -> tuple[pd.DataFrame, str]:
    """Vítimas mulheres por mês: feminicídio e homicídio doloso, que o Sinesp
    registra como eventos separados (a soma bate com o total de homicídios de
    mulheres do SIM; se um contivesse o outro, ficaria muito abaixo)."""
    partes, coleta = [], None
    ano_atual = pd.Timestamp(hoje()).year
    for ano in range(2015, ano_atual + 1):
        try:
            df, b = sinesp.mensal_brasil(ano, {"Feminicídio", "Homicídio doloso"})
        except NaoEncontrado:
            continue
        coleta = b.coletado_em
        partes.append(df)
    df = pd.concat(partes, ignore_index=True)
    p = df.pivot_table(index=["ano", "mes"], columns="evento", values=["vitimas_mulheres", "n_ufs"], aggfunc="sum")
    out = pd.DataFrame(
        {
            "feminicidio": p[("vitimas_mulheres", "Feminicídio")],
            "homicidio_doloso": p[("vitimas_mulheres", "Homicídio doloso")],
            "n_ufs": p["n_ufs"].min(axis=1),
        }
    ).reset_index().sort_values(["ano", "mes"])
    return out[out["ano"] >= 2015].reset_index(drop=True), coleta


@indicador("mulheres_assassinadas")
def mulheres_assassinadas():
    df, coleta = _sinesp_mulheres()
    datas = [dt.date(int(a), int(m), 1) for a, m in zip(df["ano"], df["mes"])]
    out = _mensal(datas, df["feminicidio"] + df["homicidio_doloso"], sinesp.URL.format(ano="AAAA"), coleta)
    completo = df["n_ufs"].to_numpy() >= 27
    out["parcial"] = ~completo
    out["entra_no_resumo"] = completo
    out["observacao"] = [
        f"{int(f)} feminicídios e {int(h)} homicídios dolosos de mulheres; {int(n)} UFs informaram"
        for f, h, n in zip(df["feminicidio"], df["homicidio_doloso"], df["n_ufs"])
    ]
    return out


@indicador("feminicidio_parcela")
def feminicidio_parcela():
    """Parcela das mulheres assassinadas registrada como feminicídio, por ano.
    Mede a classificação dos casos, não a violência."""
    df, coleta = _sinesp_mulheres()
    df = df[df["n_ufs"] >= 27]
    a = df.groupby("ano").agg(feminicidio=("feminicidio", "sum"), homicidio_doloso=("homicidio_doloso", "sum"), meses=("mes", "count")).reset_index()
    a["pct"] = (a["feminicidio"] / (a["feminicidio"] + a["homicidio_doloso"]) * 100).round(1)
    out = _anual(a["ano"], a["pct"], sinesp.URL.format(ano="AAAA"), coleta)
    incompleto = (a["meses"] < 12).to_numpy()
    out["parcial"] = incompleto
    out["entra_no_resumo"] = ~incompleto
    out["observacao"] = [
        f"{int(f):,} de {int(f + h):,} mulheres assassinadas registradas como feminicídio".replace(",", ".") + (f"; {m} meses" if m < 12 else "")
        for f, h, m in zip(a["feminicidio"], a["homicidio_doloso"], a["meses"])
    ]
    return out


@indicador("latrocinios")
def latrocinios():
    return _sinesp("Roubo seguido de morte (latrocínio)", "total_vitima")


@indicador("roubo_veiculos")
def roubo_veiculos():
    return _sinesp("Roubo de veículo", "total")


# ---------------------------------------------------------------- educação

def _ideb(etapa: str):
    df, b = inep.ideb_brasil()
    df = df[df["etapa"] == etapa].sort_values("ano")
    out = _anual(df["ano"], df["valor"], b.url, b.coletado_em)
    out["observacao"] = ["aplicação durante a pandemia" if a == 2021 else "" for a in df["ano"]]
    return out


@indicador("ideb_anos_iniciais")
def ideb_anos_iniciais():
    return _ideb("anos_iniciais")


@indicador("ideb_anos_finais")
def ideb_anos_finais():
    return _ideb("anos_finais")


@indicador("ideb_ensino_medio")
def ideb_ensino_medio():
    return _ideb("ensino_medio")


@indicador("analfabetismo")
def analfabetismo():
    df, b = sidra.consultar(7113, "10267", "all", {2: "6794", 58: "2795"})
    df = df.dropna(subset=["valor"])
    return _anual(df["periodo_codigo"], df["valor"], b.url, b.coletado_em)


# ------------------------------------------------------ macro e fiscal (BCB)

@indicador("selic_meta")
def selic_meta():
    df, bs = bcb.serie(432, "2012-01-01", diaria=True)
    df = df[df["data"] <= pd.Timestamp(hoje())].dropna(subset=["valor"])
    m = df.groupby(df["data"].dt.to_period("M")).last()
    out = _mensal(m.index.to_timestamp(), m["valor"], bcb.url_serie(432), bs[-1].coletado_em)
    atual = pd.Timestamp(hoje()).to_period("M")
    out["parcial"] = [p == str(atual) for p in out["periodo"]]
    out["entra_no_resumo"] = [not p for p in out["parcial"]]
    out["observacao"] = ["valor no último dia disponível do mês em andamento" if p else "valor no último dia do mês" for p in out["parcial"]]
    return out


@indicador("cambio")
def cambio():
    return _bcb_mensal(3698)


@indicador("endividamento_familias")
def endividamento_familias():
    return _bcb_mensal(29037)


@indicador("inadimplencia_pf")
def inadimplencia_pf():
    return _bcb_mensal(21084)


@indicador("divida_bruta")
def divida_bruta():
    return _bcb_mensal(13762)


@indicador("resultado_primario")
def resultado_primario():
    df, bs = bcb.serie(5793, "2012-01-01")
    df = df[df["data"] <= pd.Timestamp(hoje())].dropna(subset=["valor"])
    out = _mensal(df["data"], -df["valor"], bcb.url_serie(5793), bs[-1].coletado_em, janela_meses=12)
    out["observacao"] = "sinal invertido em relação ao SGS (positivo = superávit); acumulado em 12 meses"
    return out


@indicador("balanca_comercial")
def balanca_comercial():
    return _bcb_mensal(22707)

# ------------------------------------------------------------ saúde: novos indicadores
MAT = "sim/cnv/mat10br.def"
SIH = "sih/cnv/qibr.def"


def _anuais_tabnet(df: pd.DataFrame) -> pd.Series:
    rot, col = df.columns[0], df.columns[1]
    d = df[df[rot].str.fullmatch(r"\d{4}")]
    return pd.Series(d[col].to_numpy(), index=d[rot].astype(int))


def _sim_anual(selecoes: dict) -> tuple[pd.Series, int, object]:
    """Óbitos por ano de óbito (residência), sem o ano em curso, e o último ano final."""
    df, b = tabnet.consultar(OBT, "Ano_do_Óbito", "--Não-Ativa--", "Óbitos_p/Residênc", _arquivos("obtbr", OBT), selecoes)
    final, _ = _notas_prelim(b)
    s = _anuais_tabnet(df)
    return s[s.index < pd.Timestamp(hoje()).year], final, b


@indicador("mortalidade_materna")
def mortalidade_materna():
    ob, bo = tabnet.consultar(MAT, "Ano_do_Óbito", "--Não-Ativa--", "Óbitos_maternos", _arquivos("matbr", MAT))
    nv, bn = tabnet.consultar(NV, "Ano_do_nascimento", "--Não-Ativa--", "Nascim_p/resid.mãe", _arquivos("nvbr", NV))
    fo, _ = _notas_prelim(bo)
    fn = tabnet.ultimo_ano_final(bn)
    o, n = _anuais_tabnet(ob), _anuais_tabnet(nv)
    ano_atual = pd.Timestamp(hoje()).year
    anos = sorted(a for a in set(o.index) & set(n.index) if a < ano_atual)
    taxa = [round(o[a] / n[a] * 100_000, 1) for a in anos]
    out = _anual(anos, taxa, bo.url, bo.coletado_em)
    out["observacao"] = [
        f"{int(o[a]):,} óbitos maternos; {int(n[a]):,} nascidos vivos".replace(",", ".") + ("; dado preliminar" if a > min(fo, fn) else "")
        for a in anos
    ]
    return out


@indicador("obitos_dengue")
def obitos_dengue():
    # CID-10 A90 e A91 (até 2023) e A97 (desde a atualização da CID): o TabNet lista as três.
    cats = [r for _, r in tabnet.opcoes(OBT, "SCategoria_CID-10") if "engue" in r]
    s, final, b = _sim_anual({"SCategoria_CID-10": tabnet.valores(OBT, "SCategoria_CID-10", cats)})
    out = _anual(s.index, s.to_numpy(), b.url, b.coletado_em)
    out["observacao"] = ["dado preliminar" if a > final else "" for a in s.index]
    return out


@indicador("suicidios_taxa")
def suicidios_taxa():
    grupos = [r for _, r in tabnet.opcoes(OBT, "SGrupo_CID-10") if "autoprovocadas" in r.lower()]
    s, final, b = _sim_anual({"SGrupo_CID-10": tabnet.valores(OBT, "SGrupo_CID-10", grupos)})
    pop, _ = ibge_ftp.projecao_populacao_brasil()
    p = pop.set_index("ano")["populacao"]
    anos = [a for a in s.index if a in p.index]
    out = _anual(anos, [round(s[a] / p[a] * 100_000, 2) for a in anos], b.url, b.coletado_em)
    out["observacao"] = [
        f"{int(s[a]):,} óbitos; população projetada {int(p[a]):,}".replace(",", ".") + ("; dado preliminar" if a > final else "")
        for a in anos
    ]
    return out


def _wuenic(codigo: str) -> pd.DataFrame:
    df, b, revisao = oms.serie_pais(codigo)
    df = df[df["ano"] >= 2012]
    out = _anual(df["ano"], df["valor"], b.url, b.coletado_em)
    out["observacao"] = f"estimativa OMS/UNICEF (WUENIC), revisão de {revisao[8:10]}/{revisao[5:7]}/{revisao[:4]}"
    return out


@indicador("vacina_dtp3")
def vacina_dtp3():
    return _wuenic("WHS4_100")


@indicador("vacina_sarampo")
def vacina_sarampo():
    return _wuenic("WHS8_110")


@indicador("cirurgias_eletivas")
def cirurgias_eletivas():
    arq = sorted(v for v, _ in tabnet.opcoes(SIH, "Arquivos") if re.fullmatch(r"qibr\d{4}\.dbf", v) and int(v[4:6]) >= 15)
    sel = {
        "SCaráter_atendimento": tabnet.valores(SIH, "SCaráter_atendimento", ["Eletivo"]),
        "SGrupo_procedimento": tabnet.valores(SIH, "SGrupo_procedimento", ["04 Procedimentos cirurgicos"]),
    }
    df, b = tabnet.consultar(SIH, "Ano/mês_processamento", "--Não-Ativa--", "Internações", arq, sel)
    d = tabnet.linhas_ano_mes(df)
    datas = [dt.date(int(a), int(m), 1) for a, m in zip(d["ano"], d["mes"])]
    out = _mensal(datas, d["valor"], b.url, b.coletado_em)
    recentes = set(sorted(datas)[-6:])
    out["observacao"] = ["últimos seis meses: sujeito a atualização (nota do SIH)" if x in recentes else "" for x in datas]
    return out


@indicador("gasto_federal_saude")
def gasto_federal_saude():
    """Despesa empenhada da União na função Saúde (RREO, Anexo 2), em reais de hoje."""
    linhas, coleta, url = [], None, siconfi.URL
    # Desde 2017 o RREO separa as despesas intraorçamentárias e usa o mesmo rótulo de coluna.
    for ano in range(2017, pd.Timestamp(hoje()).year):
        try:
            df, b = siconfi.rreo_uniao(ano, "RREO-Anexo 02")
        except NaoEncontrado:
            continue
        coleta, url = b.coletado_em, b.url
        sel = df[
            (df["conta"].str.strip().str.lower() == "saúde")
            & (df["cod_conta"] == "RREO2TotalDespesas")
            & (df["coluna"].str.startswith("DESPESAS EMPENHADAS ATÉ O BIMESTRE"))
        ]
        if len(sel) != 1:
            raise ValueError(f"RREO {ano}: esperado 1 valor de Saúde empenhado, achei {len(sel)}")
        linhas.append((ano, float(sel["valor"].iloc[0])))
    a = pd.DataFrame(linhas, columns=["ano", "nominal"])
    # Deflator: média anual do IPCA, levada ao último mês disponível.
    s, base, _ = indice_mensal("IPCA")
    media = s.groupby(s.index.year).mean()
    a["real"] = a["nominal"] * s.iloc[-1] / a["ano"].map(media) / 1e9
    out = _anual(a["ano"], a["real"].round(1), url, coleta)
    out["observacao"] = [
        ("R$ " + f"{n / 1e9:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".") + f" bi nominais empenhados; IPCA médio do ano levado a {base}")
        for n in a["nominal"]
    ]
    return out
