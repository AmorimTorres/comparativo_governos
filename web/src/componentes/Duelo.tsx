// Os dois números lado a lado, no losango amarelo. Quando há direção
// consensual, o melhor resultado ganha o "globo" azul da bandeira, com estrela
// e a faixa branca "MELHOR". O destaque nunca depende só da cor: há o selo com
// texto e a frase no rodapé do cartão.
import type { CSSProperties } from "react";
import { numero, prefixoCurto, rotuloCurto, sufixoCurto } from "../formato";
import { type Destaque, type Metrica, type MetricaEfetiva, type ValorCartao, destaque, metricaEfetiva, rotuloMetrica, valorCartao, variacaoTexto } from "../metricas";
import type { Governo, Indicador, Resumo } from "../tipos";
import { Estrela, LosangoAlongado, MarcadorGoverno, Seta, comSetas } from "./Arte";
import { Contador } from "./Movimento";

export interface Lado {
  g: Governo;
  r: Resumo;
  v: ValorCartao;
}

export interface DadosDuelo {
  ind: Indicador;
  ef: MetricaEfetiva;
  padrao: boolean; // métrica recomendada (a vista inicial do painel)
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
  return { ind, ef, padrao: metrica === "padrao", lados, destaque: d, rotulo, janelaDesc, textoBase: `${rotulo} (${janelaDesc}). ${partes.join("; ")}.`, textoDestaque };
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

/** Largura do número em caracteres, para o tamanho da fonte caber no lado. */
function larguraNumero(v: ValorCartao, ind: Indicador, inicio: boolean): number {
  if (v.valor === null) return 3.2;
  const f = formatoNumero(ind, v.composto, v.valor);
  if (inicio) {
    const ini = v.valorInicio ?? null;
    const txt = `${v.qualificadorInicio ?? ""}${ini === null ? "—" : f.formatar(ini)}→${v.qualificador}${f.formatar(v.valor)}`;
    return txt.length + (f.suf ? 1 : 0) + 1;
  }
  const n = f.formatar(v.valor).length + (v.qualificador ? 1 : 0) + (f.pre ? 1.2 : 0) + (f.suf ? (f.suf.length > 1 ? 1.4 : 0.8) : 0);
  return Math.max(n, 3.2);
}

/** n: largura usada no tamanho da fonte — a maior dos dois lados, para os dois
 * números de um mesmo cartão saírem sempre do mesmo tamanho. */
function Numero({ v, ind, ativo, inicio, n }: { v: ValorCartao; ind: Indicador; ativo: boolean; inicio?: boolean; n: number }) {
  if (v.valor === null) return <span className="numero">—</span>;
  const f = formatoNumero(ind, v.composto, v.valor);
  if (inicio) {
    const ini = v.valorInicio ?? null;
    return (
      <span className="numero" style={{ "--n": n } as CSSProperties}>
        {v.qualificadorInicio}
        {ini === null ? "—" : <Contador valor={ini} formatar={f.formatar} ativo={ativo} />}
        <span className="seta-num"><Seta direcao="direita" /></span>
        {v.qualificador}
        <Contador valor={v.valor} formatar={f.formatar} ativo={ativo} />
        {f.suf && <small>{f.suf}</small>}
      </span>
    );
  }
  return (
    <span className="numero" style={{ "--n": n } as CSSProperties}>
      {f.pre && <span className="prefixo">{f.pre}</span>}
      {v.qualificador}
      <Contador valor={v.valor} formatar={f.formatar} ativo={ativo} />
      {f.suf && <small>{f.suf.trim()}</small>}
    </span>
  );
}

export function Duelo({ dados, destacar, ativo, mostrarJanela = true }: { dados: DadosDuelo; destacar: boolean; ativo: boolean; mostrarJanela?: boolean }) {
  const { ind, ef, padrao, lados, destaque: d } = dados;
  const n = Math.max(3.2, ...lados.map(({ v }) => larguraNumero(v, ind, ef === "inicio_fim")));
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
                  <span className="texto-reel">Melhor</span>
                </span>
              )}
              <span className="lado-quem">
                <MarcadorGoverno cor={g.estilo.cor} traco={g.estilo.traco} />
                <span className="texto-reel">{g.nome}</span>
              </span>
              <Numero v={v} ind={ind} ativo={ativo} inicio={ef === "inicio_fim"} n={n} />
              <span className="lado-ref">
                {ef === "inicio_fim" ? <span>{variacaoTexto(v, ind)}</span> : v.periodoRef && !(padrao && trienio(v)) && <span>em {rotuloCurto(v.periodoRef, ind.periodicidade)}</span>}
              </span>
              {/* espaço não separável mantém a altura padrão do losango quando a linha sai */}
              {mostrarJanela && <span className="lado-janela">{janelaCurta(v, ind, padrao) || "\u00a0"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TRIENIO = /^triênios (\d{4})-\d{4} a \d{4}-(\d{4})$/;
const trienio = (v: ValorCartao) => TRIENIO.test(v.janela);

/** Janela de cobertura no losango. As de triênios (FAO: "triênios 2018-2020 a
 * 2019-2021") não cabem no lado e viram só as datas. Na métrica recomendada, em
 * que nenhum outro cartão usa a linha de referência ("em …"), o triênio de
 * referência ("2023–2025") desce para a linha da janela, como nos demais; nas
 * outras métricas a referência fica no lugar dela e a janela vira o intervalo
 * de anos coberto ("2018–2021"). */
function janelaCurta(v: ValorCartao, ind: Indicador, padrao: boolean): string {
  const t = TRIENIO.exec(v.janela);
  if (!t) return v.janela;
  return padrao && v.periodoRef ? rotuloCurto(v.periodoRef, ind.periodicidade) : `${t[1]}–${t[2]}`;
}

/** Frase do destaque, para o rodapé do cartão e o cabeçalho do indicador. */
export function FraseDestaque({ d, ind, destacar }: { d: Destaque; ind: Indicador; destacar: boolean }) {
  if (!destacar) return null;
  const direcao = ind.sentido_desejavel === "menor_melhor" ? comSetas("↓ menor é melhor") : ind.sentido_desejavel === "maior_melhor" ? comSetas("↑ maior é melhor") : "";
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
