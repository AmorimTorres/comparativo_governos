// "Entenda este número" na página de feminicídios. Todos os números do texto
// são calculados das séries publicadas (feminicídios, mulheres assassinadas e
// parcela registrada como feminicídio); nada é digitado à mão.
import { useEffect, useMemo, useState } from "react";
import { type Minis, carregarMinis, carregarSerie } from "../dados";
import { numero } from "../formato";
import type { Metrica } from "../metricas";
import { hrefRota } from "../rota";
import type { Dados, Governo, Observacao } from "../tipos";
import { Cartao } from "./Cartao";
import { Grafico, type OpcaoGrafico } from "./Grafico";

const FONTE = "Barlow, system-ui, sans-serif";

interface Ano {
  ano: number;
  feminicidios: number;
  mulheres: number;
  parcela: number | null;
}

/** Soma por ano civil, só com os 12 meses completos (entra_no_resumo). */
function somaAnual(obs: Observacao[]): Map<number, number> {
  const meses = new Map<number, number[]>();
  for (const o of obs) {
    if (!o.entra_no_resumo) continue;
    const a = Number(o.periodo.slice(0, 4));
    if (!meses.has(a)) meses.set(a, []);
    meses.get(a)!.push(o.valor);
  }
  const out = new Map<number, number>();
  for (const [a, vs] of meses) if (vs.length === 12) out.set(a, vs.reduce((x, y) => x + y, 0));
  return out;
}

function opcao(anos: Ano[], governos: Governo[]): OpcaoGrafico {
  const rot = anos.map((a) => String(a.ano));
  const faixas = governos
    .map((g) => {
      const ini = Number(g.inicio.slice(0, 4));
      const fim = Number(g.fim.slice(0, 4));
      const dentro = rot.filter((r) => Number(r) >= ini && Number(r) <= fim);
      if (!dentro.length) return null;
      return [
        { xAxis: dentro[0], name: g.nome, itemStyle: { color: g.estilo.cor, opacity: 0.07 }, label: { color: g.estilo.cor, fontFamily: FONTE, fontWeight: 600 } },
        { xAxis: dentro[dentro.length - 1] },
      ];
    })
    .filter(Boolean);
  return {
    textStyle: { fontFamily: FONTE },
    grid: { left: 56, right: 56, top: 40, bottom: 36 },
    tooltip: {
      trigger: "axis",
      confine: true,
      formatter: (ps: Array<{ dataIndex: number }>) => {
        const a = anos[ps[0].dataIndex];
        return `<b>${a.ano}</b><br>Mulheres assassinadas: <b>${numero(a.mulheres, 0)}</b><br>Registradas como feminicídio: <b>${numero(a.feminicidios, 0)}</b>${a.parcela !== null ? `<br>Parcela: <b>${numero(a.parcela, 1)}%</b>` : ""}`;
      },
    },
    xAxis: { type: "category", data: rot, axisLabel: { color: "#5B5B5B", fontFamily: FONTE } },
    yAxis: [
      { type: "value", min: 0, name: "vítimas", nameTextStyle: { color: "#5B5B5B", align: "left" }, axisLabel: { color: "#5B5B5B", formatter: (v: number) => numero(v, 0) }, splitLine: { lineStyle: { color: "#E4E0D2" } } },
      { type: "value", min: 0, max: 100, name: "% feminicídio", nameTextStyle: { color: "#5B5B5B", align: "right" }, axisLabel: { color: "#5B5B5B", formatter: (v: number) => `${v}%` }, splitLine: { show: false } },
    ],
    series: [
      {
        name: "Mulheres assassinadas",
        type: "bar",
        data: anos.map((a) => a.mulheres),
        barMaxWidth: 44,
        itemStyle: { color: "#D8D4C6", borderColor: "#8A877C", borderWidth: 1 },
        markArea: { silent: true, data: faixas, label: { position: "insideTop" } },
      },
      {
        name: "Registradas como feminicídio",
        type: "bar",
        data: anos.map((a) => a.feminicidios),
        barGap: "-100%",
        barMaxWidth: 44,
        itemStyle: { color: "#0B6B2C" },
      },
      {
        name: "Parcela registrada como feminicídio",
        type: "line",
        yAxisIndex: 1,
        data: anos.map((a) => a.parcela),
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: "#1A1A1A", width: 2 },
        labelLayout: { hideOverlap: true },
        itemStyle: { color: "#1A1A1A" },
        label: { show: true, position: "top", color: "#1A1A1A", fontFamily: FONTE, fontWeight: 600, fontSize: 11, formatter: (p: { value: number }) => `${numero(p.value, 0)}%` },
      },
    ],
  };
}

export function AnaliseFeminicidio({ dados, governos, metrica, janela, destacar }: { dados: Dados; governos: Governo[]; metrica: Metrica; janela: boolean; destacar: boolean }) {
  const [series, setSeries] = useState<Record<string, Observacao[]> | null>(null);
  const [minis, setMinis] = useState<Minis | null>(null);
  useEffect(() => {
    Promise.all(["feminicidios", "mulheres_assassinadas", "feminicidio_parcela"].map((id) => carregarSerie(id).then((o) => [id, o] as const)))
      .then((ps) => setSeries(Object.fromEntries(ps)))
      .catch(() => setSeries({}));
    carregarMinis().then(setMinis).catch(() => setMinis({}));
  }, []);

  const anos = useMemo<Ano[]>(() => {
    if (!series?.feminicidios || !series.mulheres_assassinadas) return [];
    const f = somaAnual(series.feminicidios);
    const m = somaAnual(series.mulheres_assassinadas);
    const p = new Map((series.feminicidio_parcela ?? []).filter((o) => !o.parcial).map((o) => [Number(o.periodo), o.valor]));
    return [...f.keys()]
      .filter((a) => m.has(a))
      .sort((x, y) => x - y)
      .map((a) => ({ ano: a, feminicidios: f.get(a)!, mulheres: m.get(a)!, parcela: p.get(a) ?? null }));
  }, [series]);

  const comparaveis = ["mulheres_assassinadas", "homicidios_mulheres_taxa"]
    .map((id) => dados.catalogo.find((i) => i.indicator_id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  if (!series) return <p aria-live="polite">Carregando a análise…</p>;
  if (anos.length < 2) return null;
  const a0 = anos[0];
  const a1 = anos[anos.length - 1];
  const subiu = anos.slice(1).filter((a, k) => a.feminicidios > anos[k].feminicidios);
  const altas = subiu.length;
  // "nos dois governos" só se houve alta dentro do período de cada um.
  const emTodos = governos.every((g) => subiu.some((a) => a.ano > Number(g.inicio.slice(0, 4)) && a.ano <= Number(g.fim.slice(0, 4))));
  const varMulheres = ((a1.mulheres - a0.mulheres) / a0.mulheres) * 100;
  const descricao = `Gráfico de barras por ano, de ${a0.ano} a ${a1.ano}: total de mulheres assassinadas e, dentro dele, as registradas como feminicídio, com a parcela em linha. ${anos
    .map((a) => `${a.ano}: ${numero(a.mulheres, 0)} mulheres assassinadas, ${numero(a.feminicidios, 0)} registradas como feminicídio${a.parcela !== null ? ` (${numero(a.parcela, 1)}%)` : ""}`)
    .join("; ")}.`;

  return (
    <section className="analise" aria-labelledby="h-analise">
      <span className="kicker">Entenda este número</span>
      <h2 id="h-analise">Mais feminicídios registrados não quer dizer mais mulheres mortas</h2>
      <div className="analise-grade">
        <div className="analise-texto">
          <p>
            Os feminicídios registrados subiram em <strong>{altas} dos {anos.length - 1} anos</strong> entre {a0.ano} e {a1.ano}, de {numero(a0.feminicidios, 0)} para{" "}
            {numero(a1.feminicidios, 0)} por ano{emTodos ? ", com altas nos dois governos" : ""}. No mesmo período, o total de mulheres assassinadas (feminicídio + homicídio doloso) foi de{" "}
            {numero(a0.mulheres, 0)} para {numero(a1.mulheres, 0)} ({varMulheres >= 0 ? "+" : "−"}
            {numero(Math.abs(varMulheres), 0)}%).
          </p>
          {a0.parcela !== null && a1.parcela !== null && (
            <p>
              O que mudou foi o registro: a parcela das mulheres assassinadas que a polícia classificou como feminicídio passou de{" "}
              <strong>{numero(a0.parcela, 0)}%</strong> para <strong>{numero(a1.parcela, 0)}%</strong>. O feminicídio só virou tipo penal com a Lei 13.104/2015, e a
              classificação foi adotada aos poucos pelas polícias estaduais. Casos que antes entravam como homicídio comum passaram a entrar como feminicídio.
            </p>
          )}
          <p>
            Por isso, comparar só os feminicídios registrados favorece mecanicamente o período mais antigo, e o painel não aponta melhor resultado nesse
            indicador. Para comparar a violência letal contra mulheres, os dois indicadores abaixo contam todas as mulheres mortas, sem depender da
            classificação.
          </p>
        </div>
        <div className="painel analise-grafico">
          <Grafico opcao={opcao(anos, governos)} descricao={descricao} id="grafico-analise" />
          <p className="legenda-analise" aria-hidden="true">
            <span>
              <i style={{ background: "#D8D4C6", borderColor: "#8A877C" }} /> Mulheres assassinadas
            </span>
            <span>
              <i style={{ background: "#0B6B2C", borderColor: "#0B6B2C" }} /> Registradas como feminicídio
            </span>
            <span>
              <i className="linha" /> % registrada como feminicídio
            </span>
          </p>
          <p className="pequeno" style={{ margin: "4px 4px 0" }}>
            Só anos com os 12 meses informados por todas as UFs. Fonte: MJSP/Sinesp VDE.{" "}
            <a href={hrefRota("indicador", "feminicidio_parcela")}>Série completa da parcela</a>.
          </p>
        </div>
      </div>
      {comparaveis.length > 0 && (
        <>
          <h3 className="analise-sub">Compare pela violência, não pelo registro</h3>
          <div className="grade analise-cartoes">
            {comparaveis.map((ind) => (
              <Cartao
                key={ind.indicator_id}
                ind={ind}
                resumos={dados.resumos.filter((r) => r.indicator_id === ind.indicator_id)}
                governos={governos}
                metrica={metrica}
                janela={janela}
                destacar={destacar}
                mini={minis?.[ind.indicator_id]}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
