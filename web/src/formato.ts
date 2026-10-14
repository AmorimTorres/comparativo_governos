import type { Indicador, Periodicidade } from "./tipos";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function numero(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}

/** Número com abreviação para valores grandes (ex.: 19,3 milhões). */
export function numeroCompacto(v: number, casas = 1): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${numero(v / 1e6, casas)} mi`;
  return numero(v, 0);
}

export type ModoUnidade = "percentual" | "reais" | "outro";

export function modoUnidade(unidade: string): ModoUnidade {
  if (unidade.startsWith("%")) return "percentual";
  if (unidade.startsWith("R$")) return "reais";
  return "outro";
}

/** Sufixo curto exibido junto ao número grande (ex.: "%", "km²"). */
export function sufixoCurto(ind: Indicador, ehAcumuladoComposto = false): string {
  if (ehAcumuladoComposto) return "%";
  const u = ind.unidade;
  if (u.startsWith("%")) return "%";
  if (u.startsWith("km²")) return "km²";
  if (u.startsWith("R$ bi")) return "bi";
  if (u.startsWith("R$")) return "";
  return "";
}

export function prefixoCurto(ind: Indicador, ehAcumuladoComposto = false): string {
  if (ehAcumuladoComposto) return "";
  return ind.unidade.startsWith("R$") ? "R$" : "";
}

/** Valor formatado com unidade, para textos e tooltips. */
export function valorComUnidade(v: number | null, ind: Indicador, qualificador = "", ehAcumuladoComposto = false): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const casas = ehAcumuladoComposto ? 2 : ind.casas_decimais;
  const q = qualificador === "<" ? "menos de " : "";
  const n = numero(v, casas);
  if (ehAcumuladoComposto) return `${q}${n}%`;
  const u = ind.unidade;
  if (u.startsWith("%")) return `${q}${n}%`;
  if (u.startsWith("R$ bi")) return `${q}R$ ${n} bi`;
  if (u.startsWith("R$")) return `${q}R$ ${n}`;
  return `${q}${n} ${u.replace(/\s*\(.*\)$/, "")}`;
}

export function rotuloPeriodo(periodo: string, p: Periodicidade): string {
  if (!periodo) return "";
  if (p === "mensal") {
    const [a, m] = periodo.split("-");
    return `${MESES[Number(m) - 1]}/${a}`;
  }
  if (p === "trimestre_movel") {
    const [a, m] = periodo.split("-").map(Number);
    const ini = (m - 3 + 12) % 12;
    const meio = (m - 2 + 12) % 12;
    const anoIni = m <= 2 ? a - 1 : a;
    return anoIni === a ? `${MESES[ini]}–${MESES[meio]}–${MESES[m - 1]}/${a}` : `${MESES[ini]}/${anoIni}–${MESES[m - 1]}/${a}`;
  }
  if (p === "trimestral") {
    const [a, t] = periodo.split("T");
    return `${t}º tri/${a}`;
  }
  if (p === "anual_prodes") return `PRODES ${periodo}`;
  if (p === "trienal") return periodo.replace("-", "–");
  return periodo;
}

/** Rótulo curto (eixos e cartões): mmm/aaaa, 1T/aaaa, aaaa. */
export function rotuloCurto(periodo: string, p: Periodicidade): string {
  if (p === "mensal" || p === "trimestre_movel") {
    const [a, m] = periodo.split("-");
    return `${MESES[Number(m) - 1]}/${a}`;
  }
  if (p === "trimestral") {
    const [a, t] = periodo.split("T");
    return `${t}T/${a}`;
  }
  if (p === "trienal") return periodo.replace("-", "–");
  return periodo;
}

export function dataBr(iso: string): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function mesAno(iso: string): string {
  if (!iso) return "";
  const [a, m] = iso.slice(0, 7).split("-");
  return `${MESES[Number(m) - 1]}/${a}`;
}

export const NOMES_TEMA: Record<string, string> = {
  economia: "Economia e emprego",
  custo_de_vida: "Custo de vida",
  pobreza_fome: "Pobreza, renda e fome",
  meio_ambiente: "Meio ambiente",
  saude: "Saúde",
  seguranca: "Segurança pública",
  educacao: "Educação",
  macro_fiscal: "Macro e fiscal",
};

export const NOMES_PERIODICIDADE: Record<Periodicidade, string> = {
  mensal: "mensal",
  trimestre_movel: "trimestre móvel",
  trimestral: "trimestral",
  anual: "anual",
  anual_prodes: "anual (agosto a julho)",
  bienal: "a cada dois anos",
  trienal: "média de três anos",
};
