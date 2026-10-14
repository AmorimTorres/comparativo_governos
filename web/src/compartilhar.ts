import { type CartaoExportavel, compartilharCartao } from "./exportar";
import { NOMES_TEMA, dataBr, numero, prefixoCurto, rotuloCurto, rotuloPeriodo, sufixoCurto } from "./formato";
import { montarDuelo } from "./componentes/Duelo";
import { DIRECAO, type Metrica, metricaEfetiva, rotuloMetrica, valorCartao } from "./metricas";
import type { Governo, Indicador, Resumo } from "./tipos";

function valorCurto(v: number | null, ind: Indicador, composto: boolean, q = ""): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (q === "<") return `<${valorCurto(v, ind, composto)}`;
  const casas = composto ? 1 : ind.casas_decimais;
  const n = Math.abs(v) >= 1e6 ? `${numero(v / 1e6, 1)} mi` : numero(v, casas);
  const pre = prefixoCurto(ind, composto);
  const suf = sufixoCurto(ind, composto);
  return `${pre ? pre + " " : ""}${n}${suf === "%" ? "%" : suf ? " " + suf : ""}`;
}

export function montarCartaoExportavel(ind: Indicador, resumos: Resumo[], governos: Governo[], metrica: Metrica, janela: boolean, destacar = true): CartaoExportavel {
  const ef = metricaEfetiva(metrica, ind);
  const d = montarDuelo(ind, resumos, governos, metrica, janela).destaque;
  const lados = governos.slice(0, 2).map((g) => {
    const r = resumos.find((x) => x.governo === g.id);
    if (!r) {
      return { governo: g.nome, cor: g.estilo.cor, traco: g.estilo.traco, valorTexto: "—", janela: "sem dados", parcial: g.em_curso };
    }
    const v = valorCartao(r, ind, metrica, janela);
    const texto =
      ef === "inicio_fim"
        ? `${valorCurto(v.valorInicio ?? null, ind, false, v.qualificadorInicio).replace(/[%].*$/, "")}→${valorCurto(v.valor, ind, false, v.qualificador)}`
        : valorCurto(v.valor, ind, v.composto, v.qualificador);
    return {
      governo: g.nome,
      cor: g.estilo.cor,
      traco: g.estilo.traco,
      valorTexto: texto,
      janela: v.janela,
      parcial: g.em_curso && v.parcial,
      detalhe: v.periodoRef ? rotuloCurto(v.periodoRef, ind.periodicidade) : undefined,
      melhor: destacar && d.tipo === "melhor" && d.governo === g.id,
    };
  }) as CartaoExportavel["lados"];

  const unidadeNota = ef === "acumulado" && ind.acumulado === "composto" ? "" : ind.unidade.startsWith("R$") ? ` (${ind.unidade})` : "";
  return {
    titulo: ind.nome,
    tema: NOMES_TEMA[ind.tema] ?? ind.tema,
    metrica: `${rotuloMetrica(ef)}${unidadeNota}`,
    lados,
    fonte: `${ind.fonte_orgao} · ${ind.fonte_tabela_ou_serie}`,
    atualizacao: dataBr(ind.coletado_em),
    ultimoPeriodo: rotuloPeriodo(ind.ultimo_periodo, ind.periodicidade),
    url: `${window.location.host}${window.location.pathname}`.replace(/\/$/, ""),
    nota: !destacar ? undefined : d.tipo === "melhor" ? DIRECAO[ind.sentido_desejavel] : d.tipo === "empate" ? "Empate na precisão exibida" : undefined,
  };
}

export async function compartilhar(ind: Indicador, resumos: Resumo[], governos: Governo[], metrica: Metrica, janela: boolean, destacar = true) {
  const c = montarCartaoExportavel(ind, resumos, governos, metrica, janela, destacar);
  return compartilharCartao(c, `${ind.indicator_id}-${metrica}${janela ? "-janela-comum" : ""}.png`);
}
