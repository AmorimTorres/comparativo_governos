// Os dois números lado a lado, no losango amarelo. Quando há direção
// consensual, o melhor resultado ganha o "globo" azul da bandeira, com estrela
// e a faixa branca "MELHOR". O destaque nunca depende só da cor: há o selo com
// texto e a frase no rodapé do cartão.
import type { CSSProperties } from "react";
import { numero, prefixoCurto, rotuloCurto, sufixoCurto } from "../formato";
import { type Destaque, type Metrica, type MetricaEfetiva, type ValorCartao, destaque, metricaEfetiva, rotuloMetrica, valorCartao, variacaoTexto } from "../metricas";
import type { Governo, Indicador, Resumo } from "../tipos";
import { Estrela, LosangoAlongado, MarcadorGoverno } from "./Arte";
import { Contador } from "./Movimento";

export interface Lado {
  g: Governo;
  r: Resumo;
  v: ValorCartao;
}

export interface DadosDuelo {
  ind: Indicador;
  ef: MetricaEfetiva;
  lados: Lado[];
  destaque: Destaque;
  rotulo: string; // ex.: "Média • meses 1–44 do mandato"
  janelaDesc: string;
  textoBase: string; // métrica, janela e valores
  textoDestaque: string; // melhor resultado, empate ou motivo
}

export function montarDuelo(ind: Indicador, resumos: Resumo[], governos: Governo[], metrica: Metrica, janela: boolean): DadosDuelo {
  const ef = metricaEfetiva(metrica, ind);
  const lados = governos
    .map((g) => ({ g, r: resumos.find((r) => r.governo === g.id) }))
    .filter((x): x is { g: Governo; r: Resumo } => Boolean(x.r))
    .map(({ g, r }) => ({ g, r, v: valorCartao(r, ind, metrica, janela) }));
  const janelaDesc = janela && lados[0]?.r.n_janela_comum ? lados[0].r.janela_comum : "período disponível de cada governo";
  const rotulo = `${rotuloMetrica(ef)}${ef === "acumulado" && ind.acumulado === "soma" ? " (soma)" : ""}`;
  const d = destaque(ind, lados, metrica);
  const partes = lados.map(({ g, v }) => `${g.nome}: ${v.texto}, ${v.janela}${v.parcial && g.em_curso ? ", mandato em curso (parcial)" : ""}`);
  const textoDestaque = d.tipo === "melhor" ? `Melhor resultado: ${d.nome} (${d.texto}).` : `${d.texto}.`;
  return { ind, ef, lados, destaque: d, rotulo, janelaDesc, textoBase: `${rotulo} (${janelaDesc}). ${partes.join("; ")}.`, textoDestaque };
}

/** Formatação do número grande: prefixo, sufixo e casas como no cartão. */
export function formatoNumero(ind: Indicador, composto: boolean, referencia: number) {
  const casas = composto ? 1 : ind.casas_decimais;
  const milhoes = Math.abs(referencia) >= 1e6;
  return {
    pre: prefixoCurto(ind, composto),
    suf: milhoes ? " mi" : sufixoCurto(ind, composto),
    formatar: (x: number) => (milhoes ? numero(x / 1e6, 1) : numero(x, casas)),
  };
}

function Numero({ v, ind, ativo, inicio }: { v: ValorCartao; ind: Indicador; ativo: boolean; inicio?: boolean }) {
  if (v.valor === null) return <span className="numero">—</span>;
  const f = formatoNumero(ind, v.composto, v.valor);
  if (inicio) {
    const ini = v.valorInicio ?? null;
    const txt = `${v.qualificadorInicio ?? ""}${ini === null ? "—" : f.formatar(ini)}→${v.qualificador}${f.formatar(v.valor)}`;
    return (
      <span className="numero" style={{ "--n": txt.length + (f.suf ? 1 : 0) + 1 } as CSSProperties}>
        {v.qualificadorInicio}
        {ini === null ? "—" : <Contador valor={ini} formatar={f.formatar} ativo={ativo} />}
        <span className="seta-num">→</span>
        {v.qualificador}
        <Contador valor={v.valor} formatar={f.formatar} ativo={ativo} />
        {f.suf && <small>{f.suf}</small>}
      </span>
    );
  }
  const n = f.formatar(v.valor).length + (v.qualificador ? 1 : 0) + (f.pre ? 1.2 : 0) + (f.suf ? (f.suf.length > 1 ? 1.4 : 0.8) : 0);
  return (
    <span className="numero" style={{ "--n": Math.max(n, 3.2) } as CSSProperties}>
      {f.pre && <span className="prefixo">{f.pre}</span>}
      {v.qualificador}
      <Contador valor={v.valor} formatar={f.formatar} ativo={ativo} />
      {f.suf && <small>{f.suf.trim()}</small>}
    </span>
  );
}

export function Duelo({ dados, destacar, ativo, mostrarJanela = true }: { dados: DadosDuelo; destacar: boolean; ativo: boolean; mostrarJanela?: boolean }) {
  const { ind, ef, lados, destaque: d } = dados;
  return (
    <div className={`duelo${ativo ? " visivel" : ""}`} aria-hidden="true">
      <LosangoAlongado />
      <div className="duelo-lados">
        {lados.map(({ g, v }) => {
          const melhor = destacar && d.tipo === "melhor" && d.governo === g.id;
          return (
            <div key={g.id} className={`lado${melhor ? " melhor" : ""}`}>
              {melhor && (
                <span className="selo-melhor">
                  <Estrela tamanho={13} />
                  Melhor
                </span>
              )}
              <span className="lado-quem">
                <MarcadorGoverno cor={g.estilo.cor} marcador={g.estilo.marcador} />
                {g.nome}
              </span>
              <Numero v={v} ind={ind} ativo={ativo} inicio={ef === "inicio_fim"} />
              <span className="lado-ref">
                {ef === "inicio_fim" ? <span>{variacaoTexto(v, ind)}</span> : v.periodoRef && <span>em {rotuloCurto(v.periodoRef, ind.periodicidade)}</span>}
              </span>
              {mostrarJanela && <span className="lado-janela">{v.janela}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Frase do destaque, para o rodapé do cartão e o cabeçalho do indicador. */
export function FraseDestaque({ d, ind, destacar }: { d: Destaque; ind: Indicador; destacar: boolean }) {
  if (!destacar) return null;
  const direcao = ind.sentido_desejavel === "menor_melhor" ? "↓ menor é melhor" : ind.sentido_desejavel === "maior_melhor" ? "↑ maior é melhor" : "";
  return (
    <p className={`frase-destaque ${d.tipo}`}>
      {d.tipo === "melhor" ? (
        <>
          <Estrela tamanho={14} />
          <strong>{d.nome}</strong>
          <span>{d.texto}</span>
        </>
      ) : (
        <span>{d.texto}</span>
      )}
      {direcao && d.tipo !== "sem_direcao" && <span className="direcao">{direcao}</span>}
    </p>
  );
}
