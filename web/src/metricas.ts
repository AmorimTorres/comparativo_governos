import { numero, rotuloCurto, valorComUnidade } from "./formato";
import type { Governo, Indicador, Resumo } from "./tipos";

export type Metrica = "padrao" | "media" | "acumulado" | "fim" | "inicio_fim" | "pico" | "vale";
export type MetricaEfetiva = Exclude<Metrica, "padrao">;

export const NOMES_METRICA: Record<Metrica, string> = {
  padrao: "Recomendada",
  media: "Média",
  acumulado: "Acumulado",
  fim: "Último valor",
  inicio_fim: "Início → fim",
  pico: "Pico",
  vale: "Vale",
};

export const AJUDA_METRICA: Record<Metrica, string> = {
  padrao: "a métrica mais adequada a cada indicador",
  media: "média de todos os períodos do mandato",
  acumulado: "variação composta ou soma no mandato (onde faz sentido)",
  fim: "valor no último período da janela",
  inicio_fim: "primeiro e último valor da janela",
  pico: "maior valor da janela",
  vale: "menor valor da janela",
};

export interface ValorCartao {
  valor: number | null;
  qualificador: string; // "<" quando o valor é só um limite superior (ex.: FAO "<2,5")
  valorInicio?: number | null; // só em início → fim
  qualificadorInicio?: string;
  texto: string; // texto acessível completo
  composto: boolean; // acumulado composto (sempre em %)
  periodoRef: string; // período do pico, vale ou fim
  janela: string; // cobertura do governo nesta métrica (ex.: jan/2019–ago/2022)
  parcial: boolean;
  nota: string;
}

/** Resolve a métrica efetiva (a "recomendada" depende do indicador e
 * acumulado só vale para fluxos e variações). */
export function metricaEfetiva(m: Metrica, ind: Indicador): MetricaEfetiva {
  if (m === "padrao") return ind.metrica_padrao;
  if (m === "acumulado" && !ind.acumulado) return "media";
  return m;
}

export function rotuloMetrica(m: MetricaEfetiva): string {
  return { media: "Média", acumulado: "Acumulado", inicio_fim: "Início → fim", pico: "Pico", vale: "Vale", fim: "Último valor" }[m];
}

export function valorCartao(r: Resumo, ind: Indicador, m: Metrica, janela: boolean): ValorCartao {
  const ef = metricaEfetiva(m, ind);
  const usarJanela = janela && r.n_janela_comum > 0;
  const per = ind.periodicidade;
  const cobertura = usarJanela ? r.periodo_coberto_janela_comum : r.periodo_coberto;
  const composto = ef === "acumulado" && ind.acumulado === "composto";
  let valor: number | null = null;
  let valorInicio: number | null | undefined;
  let periodoRef = "";
  let nota = "";
  switch (ef) {
    case "media":
      valor = usarJanela ? r.media_janela_comum : r.media;
      if (valor === null && r.observacao) nota = "média não calculada: há valores abaixo do limite de divulgação";
      break;
    case "acumulado":
      valor = usarJanela ? r.acumulado_janela_comum : r.acumulado;
      break;
    case "fim":
      valor = usarJanela ? r.valor_fim_janela_comum : r.valor_fim;
      periodoRef = usarJanela ? r.periodo_fim_janela_comum : r.periodo_fim;
      break;
    case "inicio_fim":
      valorInicio = usarJanela ? r.valor_inicio_janela_comum : r.valor_inicio;
      valor = usarJanela ? r.valor_fim_janela_comum : r.valor_fim;
      periodoRef = usarJanela ? r.periodo_fim_janela_comum : r.periodo_fim;
      break;
    case "pico":
      valor = usarJanela ? r.maximo_janela_comum : r.maximo;
      periodoRef = usarJanela ? r.periodo_maximo_janela_comum : r.periodo_maximo;
      break;
    case "vale":
      valor = usarJanela ? r.minimo_janela_comum : r.minimo;
      periodoRef = usarJanela ? r.periodo_minimo_janela_comum : r.periodo_minimo;
      break;
  }
  const q = (per: string) => (per && r.periodos_censurados.includes(per) ? "<" : "");
  const periodoInicio = usarJanela ? r.periodo_inicio_janela_comum : r.periodo_inicio;
  const qualificador = ef === "media" || ef === "acumulado" ? "" : q(periodoRef);
  const qualificadorInicio = ef === "inicio_fim" ? q(periodoInicio) : undefined;
  const v = valorComUnidade(valor, ind, qualificador, composto);
  const texto =
    ef === "inicio_fim"
      ? `${valorComUnidade(valorInicio ?? null, ind, qualificadorInicio)} → ${v}`
      : periodoRef
        ? `${v} (${rotuloCurto(periodoRef, per)})`
        : v;
  return { valor, qualificador, valorInicio, qualificadorInicio, texto, composto, periodoRef, janela: cobertura, parcial: !r.mandato_completo, nota };
}

export function descricaoJanela(resumos: Resumo[], janela: boolean): string {
  const r = resumos.find((x) => x.n_janela_comum > 0);
  if (!janela || !r) return "mandato completo × período disponível";
  return r.janela_comum;
}

// ---------------------------------------------------------------------------
// Melhor resultado
//
// O painel destaca o governo com o melhor resultado só quando a direção
// desejável é consensual (sentido_desejavel ≠ neutro) e o indicador não é de
// contexto. A comparação usa exatamente o número exibido (mesma métrica, mesma
// janela, mesma precisão): valores iguais na precisão exibida contam como
// empate. Valores censurados ("menos de 2,5%") só decidem quando o outro valor
// está acima do limite.

export type Destaque =
  | { tipo: "melhor"; governo: string; nome: string; texto: string }
  | { tipo: "empate"; texto: string }
  | { tipo: "sem_direcao"; texto: string }
  | { tipo: "indefinido"; texto: string };

export const DIRECAO: Record<string, string> = { menor_melhor: "menor é melhor", maior_melhor: "maior é melhor" };
export const SETA: Record<string, string> = { menor_melhor: "↓", maior_melhor: "↑" };

/** Arredonda como o número aparece no cartão (milhões com 1 casa, acumulado composto com 1). */
export function arredondaExibicao(v: number, ind: Indicador, composto: boolean): number {
  if (Math.abs(v) >= 1e6) return Math.round(v / 1e5) / 10;
  const casas = composto ? 1 : ind.casas_decimais;
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

interface Ponto {
  v: number | null;
  q: string;
}

/** 0 se o lado a é melhor, 1 se o b é, "empate" ou null (não dá para decidir). */
function melhorEntre(a: Ponto, b: Ponto, menorMelhor: boolean, ind: Indicador, composto: boolean): 0 | 1 | "empate" | null {
  if (a.v === null || b.v === null || !Number.isFinite(a.v) || !Number.isFinite(b.v)) return null;
  const ra = arredondaExibicao(a.v, ind, composto);
  const rb = arredondaExibicao(b.v, ind, composto);
  let menor: 0 | 1;
  if (a.q === "<" && b.q === "<") return null;
  if (a.q === "<" || b.q === "<") {
    // O valor censurado é menor que o limite; só é certamente o menor se o outro estiver no limite ou acima.
    const [limite, outro, idx] = a.q === "<" ? [ra, rb, 0 as const] : [rb, ra, 1 as const];
    if (outro < limite) return null;
    menor = idx;
  } else {
    if (ra === rb) return "empate";
    menor = ra < rb ? 0 : 1;
  }
  return menorMelhor ? menor : ((1 - menor) as 0 | 1);
}

function diferencaTexto(vMelhor: number, vOutro: number, ind: Indicador, composto: boolean, menorMelhor: boolean): string {
  const sentido = menorMelhor ? "menor" : "maior";
  const d = Math.abs(vMelhor - vOutro);
  if (composto || ind.unidade.startsWith("%")) {
    const casas = composto ? 1 : Math.max(1, Math.min(ind.casas_decimais, 2));
    return `${numero(d, casas)} p.p. ${sentido}`;
  }
  if (vOutro !== 0 && Math.sign(vOutro) === Math.sign(vMelhor)) {
    const rel = (d / Math.abs(vOutro)) * 100;
    return `${numero(rel, rel < 1 ? 1 : 0)}% ${sentido}`;
  }
  // Sem base para porcentagem (o outro é zero ou tem sinal oposto): diferença absoluta.
  if (Math.abs(d) < 1e6 && !ind.unidade.startsWith("R$")) return `${numero(d, composto ? 1 : ind.casas_decimais)} ${ind.unidade} a ${menorMelhor ? "menos" : "mais"}`;
  return sentido;
}

export function destaque(ind: Indicador, valores: { g: Governo; v: ValorCartao }[], m: Metrica): Destaque {
  if (ind.camada === "contexto") return { tipo: "sem_direcao", texto: "Contexto: sem comparação de desempenho" };
  if (ind.sentido_desejavel === "neutro") return { tipo: "sem_direcao", texto: ind.motivo_sem_destaque || "Sem direção consensual: o painel não aponta melhor" };
  if (valores.length < 2) return { tipo: "indefinido", texto: "Sem dados dos dois governos" };
  const menorMelhor = ind.sentido_desejavel === "menor_melhor";
  const ef = metricaEfetiva(m, ind);
  const [a, b] = valores;
  let r: 0 | 1 | "empate" | null;
  let texto = "";
  if (ef === "inicio_fim") {
    const ok = (x: ValorCartao) => x.valor !== null && x.valorInicio !== null && x.valorInicio !== undefined && !x.qualificador && !x.qualificadorInicio;
    if (!ok(a.v) || !ok(b.v)) return { tipo: "indefinido", texto: "Variação não comparável" };
    const da = (a.v.valor as number) - (a.v.valorInicio as number);
    const db = (b.v.valor as number) - (b.v.valorInicio as number);
    r = melhorEntre({ v: da, q: "" }, { v: db, q: "" }, menorMelhor, ind, false);
    texto = "variação mais favorável";
  } else {
    r = melhorEntre({ v: a.v.valor, q: a.v.qualificador }, { v: b.v.valor, q: b.v.qualificador }, menorMelhor, ind, a.v.composto);
    if (r === 0 || r === 1) {
      const [w, l] = r === 0 ? [a, b] : [b, a];
      texto = w.v.qualificador === "<" ? `abaixo do limite de divulgação` : diferencaTexto(w.v.valor as number, l.v.valor as number, ind, a.v.composto, menorMelhor);
    }
  }
  if (r === "empate") return { tipo: "empate", texto: "Empate na precisão exibida" };
  if (r === null) return { tipo: "indefinido", texto: "Valores abaixo do limite de divulgação: não dá para apontar melhor" };
  const w = r === 0 ? a : b;
  return { tipo: "melhor", governo: w.g.id, nome: w.g.nome, texto };
}

/** Variação início → fim formatada (ex.: "−3,1 p.p."). */
export function variacaoTexto(v: ValorCartao, ind: Indicador): string {
  if (v.valor === null || v.valorInicio === null || v.valorInicio === undefined) return "";
  const d = v.valor - v.valorInicio;
  const pct = ind.unidade.startsWith("%");
  const casas = pct ? Math.max(1, Math.min(ind.casas_decimais, 2)) : ind.casas_decimais;
  const s = d > 0 ? "+" : d < 0 ? "−" : "";
  const n = Math.abs(d) >= 1e6 ? `${numero(Math.abs(d) / 1e6, 1)} mi` : numero(Math.abs(d), casas);
  if (ind.unidade.startsWith("R$")) return `${s}R$ ${n}`;
  return `${s}${n}${pct ? " p.p." : ""}`;
}
