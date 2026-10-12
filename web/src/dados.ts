import { csvParse } from "d3-dsv";
import type { Dados, Evento, Governo, Indicador, Observacao, Resumo } from "./tipos";

const BASE = "./data/";

const num = (s: string | undefined): number | null => {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const bool = (s: string | undefined) => s === "True" || s === "true";

async function texto(arquivo: string): Promise<string> {
  const r = await fetch(BASE + arquivo);
  if (!r.ok) throw new Error(`Não foi possível carregar ${arquivo} (${r.status})`);
  return r.text();
}

let cacheDados: Promise<Dados> | null = null;

export function carregarDados(): Promise<Dados> {
  if (!cacheDados) cacheDados = carregar();
  return cacheDados;
}

async function carregar(): Promise<Dados> {
  const [cat, res, ev, gov, rel] = await Promise.all([
    texto("catalogo_indicadores.csv"),
    texto("resumos_por_governo.csv"),
    texto("eventos_contexto.csv"),
    texto("governos.json"),
    texto("relatorio_execucao.json").catch(() => "{}"),
  ]);
  const catalogo: Indicador[] = csvParse(cat).map((l) => ({
    ...(l as unknown as Indicador),
    ordem: Number(l.ordem),
    casas_decimais: Number(l.casas_decimais),
  }));
  const resumos: Resumo[] = csvParse(res).map((l) => ({
    ...(l as unknown as Resumo),
    media: num(l.media),
    acumulado: num(l.acumulado),
    valor_inicio: Number(l.valor_inicio),
    valor_fim: Number(l.valor_fim),
    minimo: Number(l.minimo),
    maximo: Number(l.maximo),
    n_observacoes: Number(l.n_observacoes),
    mandato_completo: bool(l.mandato_completo),
    n_janela_comum: Number(l.n_janela_comum),
    media_janela_comum: num(l.media_janela_comum),
    acumulado_janela_comum: num(l.acumulado_janela_comum),
    valor_inicio_janela_comum: num(l.valor_inicio_janela_comum),
    valor_fim_janela_comum: num(l.valor_fim_janela_comum),
    minimo_janela_comum: num(l.minimo_janela_comum),
    maximo_janela_comum: num(l.maximo_janela_comum),
    periodos_censurados: (l.periodos_censurados ?? "").split(";").filter(Boolean),
  }));
  const eventos: Evento[] = csvParse(ev).map((l) => ({
    data_inicio: l.data_inicio ?? "",
    data_fim: l.data_fim ?? "",
    evento: l.evento ?? "",
    categoria: l.categoria ?? "",
    descricao: l.descricao ?? "",
    exibir_no_grafico: l.exibir_no_grafico !== "False",
    indicadores_afetados: (l.indicadores_afetados ?? "").split(";").filter(Boolean),
    fonte_url: (l.fonte_url ?? "").split(/\s*;\s*/).filter(Boolean),
  }));
  const g = JSON.parse(gov) as { governos: Governo[]; comparacao_padrao: string[] };
  const relatorio = JSON.parse(rel) as { executado_em?: string };
  return { catalogo, resumos, eventos, governos: g.governos, comparados: g.comparacao_padrao, executadoEm: relatorio.executado_em ?? "" };
}

const cacheSeries = new Map<string, Promise<Observacao[]>>();

export function carregarSerie(id: string): Promise<Observacao[]> {
  if (!cacheSeries.has(id)) {
    cacheSeries.set(
      id,
      texto(`series/${encodeURIComponent(id)}.csv`).then((t) =>
        csvParse(t).map((l) => ({
          ...(l as unknown as Observacao),
          valor: Number(l.valor),
          mes_do_mandato: num(l.mes_do_mandato),
          ano_do_mandato: num(l.ano_do_mandato),
          parcial: bool(l.parcial),
          entra_no_resumo: bool(l.entra_no_resumo),
          qualificador: l.qualificador ?? "",
          observacao: l.observacao ?? "",
        })),
      ),
    );
  }
  return cacheSeries.get(id)!;
}

export function urlCsvIndicador(id: string): string {
  return `${BASE}series/${encodeURIComponent(id)}.csv`;
}

/** Ponto do minigráfico: [mês ou ano do mandato, valor, vazado (1 = parcial, fora das médias ou limite)]. */
export type PontoMini = [number, number, 0 | 1];
export type Minis = Record<string, Record<string, PontoMini[]>>;

let cacheMinis: Promise<Minis> | null = null;

export function carregarMinis(): Promise<Minis> {
  if (!cacheMinis) cacheMinis = texto("minis.json").then((t) => JSON.parse(t) as Minis);
  return cacheMinis;
}
