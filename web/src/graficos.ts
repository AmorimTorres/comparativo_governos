import type { OpcaoGrafico } from "./componentes/Grafico";
import { NOMES_PERIODICIDADE, numero, rotuloPeriodo, valorComUnidade } from "./formato";
import type { Evento, Governo, Indicador, Observacao } from "./tipos";

const FONTE = "Barlow, system-ui, sans-serif";
const CINZA = "#5B5B5B";
const GRADE = "#E4E0D2";
const OUTRO = "#8A877C";

const TRACO: Record<string, "solid" | "dashed" | "dotted"> = { solido: "solid", tracejado: "dashed", pontilhado: "dotted" };
const SIMBOLO: Record<string, string> = { circulo: "circle", quadrado: "rect", triangulo: "triangle", losango: "diamond" };
const SIMBOLO_VAZADO: Record<string, string> = { circulo: "emptyCircle", quadrado: "emptyRect", triangulo: "emptyTriangle", losango: "emptyDiamond" };

export function posicaoMandato(ind: Indicador): "mes_do_mandato" | "ano_do_mandato" {
  return ["mensal", "trimestre_movel", "trimestral"].includes(ind.periodicidade) ? "mes_do_mandato" : "ano_do_mandato";
}

function mesesDesde(inicio: string, data: string): number {
  const [a1, m1] = inicio.split("-").map(Number);
  const [a2, m2] = data.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

function meio(o: Observacao): number {
  return (Date.parse(o.data_inicio) + Date.parse(o.data_fim)) / 2;
}

function eixoY(ind: Indicador, valores: number[]) {
  const comecaEmZero = ind.acumulado === "soma" && valores.every((v) => v >= 0);
  return {
    type: "value" as const,
    min: comecaEmZero ? 0 : undefined,
    scale: !comecaEmZero,
    name: ind.unidade,
    nameTextStyle: { color: CINZA, fontFamily: FONTE, align: "left" as const },
    axisLabel: { color: CINZA, fontFamily: FONTE, formatter: (v: number) => numero(v, Math.abs(v) >= 1000 ? 0 : Math.min(ind.casas_decimais, 2)) },
    splitLine: { lineStyle: { color: GRADE } },
  };
}

function textoObs(o: Observacao, ind: Indicador): string {
  const notas = [o.parcial ? "parcial" : "", o.observacao].filter(Boolean).join("; ");
  return `${rotuloPeriodo(o.periodo, ind.periodicidade)}: <b>${valorComUnidade(o.valor, ind, o.qualificador)}</b>${notas ? `<br><span style="color:${CINZA}">${notas}</span>` : ""}`;
}

/** Linhas sobrepostas por mês (ou ano) de mandato. */
export function opcaoMesMandato(ind: Indicador, obs: Observacao[], governos: Governo[], eventos: Evento[], mostrarEventos: boolean): OpcaoGrafico {
  const pos = posicaoMandato(ind);
  const mensal = pos === "mes_do_mandato";
  const series = governos.map((g) => {
    const dados = obs
      .filter((o) => o.governo === g.id && o[pos] !== null)
      .sort((a, b) => (a[pos] as number) - (b[pos] as number))
      .map((o) => ({
        value: [o[pos], o.valor],
        obs: o,
        symbol: o.parcial || !o.entra_no_resumo || o.qualificador ? SIMBOLO_VAZADO[g.estilo.marcador] : SIMBOLO[g.estilo.marcador],
      }));
    const ultimo = dados[dados.length - 1];
    const marcas = mostrarEventos ? eventosNoMandato(eventos, ind, g, mensal) : null;
    return {
      name: g.nome,
      type: "line",
      data: dados,
      symbolSize: mensal && dados.length > 20 ? 5 : 8,
      showAllSymbol: true,
      color: g.estilo.cor,
      lineStyle: { color: g.estilo.cor, width: 2.5, type: TRACO[g.estilo.traco] },
      itemStyle: { color: g.estilo.cor },
      endLabel: {
        show: Boolean(ultimo),
        formatter: () => `${g.nome} ${ultimo ? valorComUnidade(ultimo.obs.valor, ind, ultimo.obs.qualificador) : ""}${g.em_curso ? " (parcial)" : ""}`,
        color: g.estilo.cor,
        fontFamily: FONTE,
        fontWeight: 600,
        fontSize: 13,
      },
      // Rótulos finais no mesmo valor (ex.: os dois em 0) se afastam na vertical.
      labelLayout: { moveOverlap: "shiftY" },
      emphasis: { focus: "series" },
      ...(marcas ?? {}),
    };
  });
  const todos = obs.filter((o) => o.governo !== "outro").map((o) => o.valor);
  return {
    textStyle: { fontFamily: FONTE },
    grid: { left: 64, right: 150, top: 48, bottom: 56 },
    tooltip: {
      trigger: "axis",
      confine: true,
      formatter: (ps: Array<{ data: { obs: Observacao }; color: string; seriesName: string }>) => {
        if (!ps.length) return "";
        const x = (ps[0].data as unknown as { value: number[] }).value[0];
        const cab = mensal ? `Mês ${x} do mandato` : `Ano ${x} do mandato`;
        return [cab, ...ps.map((p) => `<span style="color:${p.color}">●</span> ${p.seriesName} · ${textoObs(p.data.obs, ind)}`)].join("<br>");
      },
    },
    xAxis: {
      type: "value",
      min: mensal ? 1 : 1,
      max: mensal ? 48 : 4,
      interval: mensal ? 6 : 1,
      name: mensal ? "mês do mandato" : "ano do mandato",
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { color: CINZA, fontFamily: FONTE },
      axisLabel: { color: CINZA, fontFamily: FONTE },
      splitLine: { show: false },
    },
    yAxis: eixoY(ind, todos),
    series,
  };
}

function eventosNoMandato(eventos: Evento[], ind: Indicador, g: Governo, mensal: boolean) {
  const relevantes = eventos.filter((e) => e.exibir_no_grafico && e.indicadores_afetados.includes(ind.indicator_id));
  const conv = (d: string) => (mensal ? mesesDesde(g.inicio, d) + 1 : Number(d.slice(0, 4)) - Number(g.inicio.slice(0, 4)) + 1);
  const max = mensal ? 48 : 4;
  const areas: unknown[] = [];
  const linhas: unknown[] = [];
  for (const e of relevantes) {
    const ini = conv(e.data_inicio);
    const fim = e.data_fim ? conv(e.data_fim) : null;
    if ((fim ?? ini) < 1 || ini > max) continue;
    const curto = e.evento.length > 26 ? e.evento.slice(0, 25) + "…" : e.evento;
    const rot = { formatter: `${g.nome}: ${curto}`, color: CINZA, fontFamily: FONTE, fontSize: 11 };
    if (fim !== null && fim > ini) areas.push([{ xAxis: Math.max(ini, 1), name: e.evento, label: rot }, { xAxis: Math.min(fim, max) }]);
    else linhas.push({ xAxis: ini, name: e.evento, label: rot });
  }
  return {
    markArea: areas.length ? { silent: true, itemStyle: { color: g.estilo.cor, opacity: 0.07 }, label: { position: "insideTop" }, data: areas } : undefined,
    markLine: linhas.length ? { silent: true, symbol: "none", lineStyle: { color: CINZA, type: "dotted", width: 1 }, label: { position: "end", rotate: 0, align: "left" }, data: linhas } : undefined,
  };
}

/** Série em datas de calendário, com faixas dos mandatos e eventos. */
export function opcaoCalendario(ind: Indicador, obs: Observacao[], governos: Governo[], eventos: Evento[], mostrarEventos: boolean): OpcaoGrafico {
  const ordenadas = [...obs].sort((a, b) => meio(a) - meio(b));
  const por = (id: string) =>
    ordenadas.filter((o) => o.governo === id).map((o) => ({ value: [meio(o), o.valor], obs: o }));
  const relevantes = eventos.filter((e) => e.exibir_no_grafico && e.indicadores_afetados.includes(ind.indicator_id));
  const series: unknown[] = [
    {
      name: "Antes de 2019",
      type: "line",
      data: por("outro"),
      color: OUTRO,
      lineStyle: { color: OUTRO, width: 1.5, type: "dotted" },
      itemStyle: { color: OUTRO },
      symbolSize: 4,
      markArea: {
        silent: true,
        data: governos.map((g) => [
          { xAxis: Date.parse(g.inicio), name: g.nome, itemStyle: { color: g.estilo.cor, opacity: 0.06 }, label: { color: g.estilo.cor, fontFamily: FONTE, fontWeight: 600, position: "insideTopLeft" } },
          { xAxis: Math.min(Date.parse(g.fim), Date.now()) },
        ]),
      },
      markLine: mostrarEventos
        ? {
            silent: true,
            symbol: "none",
            lineStyle: { color: CINZA, type: "dotted" },
            label: { color: CINZA, fontFamily: FONTE, fontSize: 11, position: "end", rotate: 0, align: "left" },
            data: relevantes.map((e) => ({ xAxis: Date.parse(e.data_inicio), name: e.evento, label: { formatter: e.evento.length > 22 ? e.evento.slice(0, 21) + "…" : e.evento } })),
          }
        : undefined,
    },
    ...governos.map((g) => ({
      name: g.nome,
      type: "line",
      data: por(g.id),
      color: g.estilo.cor,
      lineStyle: { color: g.estilo.cor, width: 2.2, type: TRACO[g.estilo.traco] },
      itemStyle: { color: g.estilo.cor },
      symbol: SIMBOLO[g.estilo.marcador],
      symbolSize: ordenadas.length > 60 ? 4 : 7,
    })),
  ];
  return {
    textStyle: { fontFamily: FONTE },
    grid: { left: 64, right: 24, top: 48, bottom: 40 },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: { data: { obs: Observacao }; seriesName: string; color: string }) =>
        `<span style="color:${p.color}">●</span> ${p.seriesName}<br>${textoObs(p.data.obs, ind)}`,
    },
    xAxis: { type: "time", axisLabel: { color: CINZA, fontFamily: FONTE }, splitLine: { show: false } },
    yAxis: eixoY(ind, obs.map((o) => o.valor)),
    series,
  };
}

interface Barra {
  rotulo: string;
  valor: number;
  governo: string;
  parcial: boolean;
}

/** Agrega por ano civil (sub-anuais) ou usa o próprio período (anuais). */
export function barrasAnuais(ind: Indicador, obs: Observacao[]): Barra[] {
  if (!["mensal", "trimestre_movel", "trimestral"].includes(ind.periodicidade)) {
    return obs.map((o) => ({ rotulo: o.periodo.replace("-", "–"), valor: o.valor, governo: o.governo, parcial: o.parcial }));
  }
  const esperado = ind.periodicidade === "trimestral" ? 4 : 12;
  const anos = new Map<string, Observacao[]>();
  for (const o of obs) {
    const a = o.data_fim.slice(0, 4);
    if (!anos.has(a)) anos.set(a, []);
    anos.get(a)!.push(o);
  }
  return [...anos.entries()].map(([a, os]) => {
    const vs = os.map((o) => o.valor);
    let valor: number;
    if (ind.acumulado === "soma") valor = vs.reduce((x, y) => x + y, 0);
    else if (ind.acumulado === "composto") valor = (vs.reduce((f, v) => f * (1 + v / 100), 1) - 1) * 100;
    else valor = vs.reduce((x, y) => x + y, 0) / vs.length;
    const incompleto = os.length < esperado || os.some((o) => o.parcial);
    const cont = new Map<string, number>();
    os.forEach((o) => cont.set(o.governo, (cont.get(o.governo) ?? 0) + 1));
    const governo = [...cont.entries()].sort((x, y) => y[1] - x[1])[0][0];
    return { rotulo: incompleto ? `${a}*` : a, valor, governo, parcial: incompleto };
  });
}

export function descricaoAgregacaoAnual(ind: Indicador): string {
  if (!["mensal", "trimestre_movel", "trimestral"].includes(ind.periodicidade)) return `Um valor por período (${NOMES_PERIODICIDADE[ind.periodicidade]}).`;
  if (ind.acumulado === "soma") return "Soma dos meses de cada ano civil.";
  if (ind.acumulado === "composto") return "Variação acumulada em cada ano civil (composição das variações mensais).";
  return "Média dos valores de cada ano civil.";
}

export function opcaoBarras(ind: Indicador, obs: Observacao[], governos: Governo[]): OpcaoGrafico {
  const barras = barrasAnuais(ind, obs);
  const estilo = (gid: string) => governos.find((g) => g.id === gid);
  const composto = ind.acumulado === "composto";
  return {
    textStyle: { fontFamily: FONTE },
    grid: { left: 64, right: 16, top: 36, bottom: 48 },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: { name: string; value: number; data: { b: Barra } }) =>
        `${p.name.replace("*", "")}${p.data.b.parcial ? " (ano incompleto)" : ""}<br><b>${valorComUnidade(p.value, ind, "", composto)}</b>`,
    },
    xAxis: { type: "category", data: barras.map((b) => b.rotulo), axisLabel: { color: CINZA, fontFamily: FONTE, rotate: barras.length > 10 ? 45 : 0 } },
    yAxis: { ...eixoY({ ...ind, acumulado: "soma" }, barras.map((b) => b.valor)), name: composto ? "% no ano" : ind.unidade },
    series: [
      {
        type: "bar",
        data: barras.map((b) => {
          const g = estilo(b.governo);
          const cor = g?.estilo.cor ?? OUTRO;
          const listrado = g?.estilo.traco === "tracejado";
          return {
            value: b.valor,
            b,
            itemStyle: {
              color: cor,
              opacity: b.parcial ? 0.55 : 1,
              decal: listrado ? { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: -Math.PI / 4, color: "rgba(255,255,255,0.45)" } : undefined,
              borderColor: cor,
              borderWidth: 1,
            },
          };
        }),
        label: {
          show: barras.length <= 16,
          position: "top",
          color: CINZA,
          fontFamily: FONTE,
          fontSize: 11,
          formatter: (p: { value: number }) => numero(p.value, Math.abs(p.value) >= 1000 ? 0 : composto ? 1 : Math.min(ind.casas_decimais, 2)),
        },
        barMaxWidth: 40,
      },
    ],
  };
}

/** Texto alternativo gerado a partir dos dados do gráfico. */
export function descricaoGrafico(ind: Indicador, obs: Observacao[], governos: Governo[]): string {
  const partes = governos.map((g) => {
    const os = obs.filter((o) => o.governo === g.id);
    if (!os.length) return `${g.nome}: sem dados`;
    const ini = os[0];
    const fim = os[os.length - 1];
    const max = os.reduce((a, b) => (b.valor > a.valor ? b : a));
    const min = os.reduce((a, b) => (b.valor < a.valor ? b : a));
    return `${g.nome}: de ${valorComUnidade(ini.valor, ind, ini.qualificador)} em ${rotuloPeriodo(ini.periodo, ind.periodicidade)} a ${valorComUnidade(fim.valor, ind, fim.qualificador)} em ${rotuloPeriodo(fim.periodo, ind.periodicidade)}; máximo ${valorComUnidade(max.valor, ind, max.qualificador)} (${rotuloPeriodo(max.periodo, ind.periodicidade)}), mínimo ${valorComUnidade(min.valor, ind, min.qualificador)} (${rotuloPeriodo(min.periodo, ind.periodicidade)})`;
  });
  return `${ind.nome}. ${partes.join(". ")}. A tabela de dados abaixo traz todos os valores.`;
}
