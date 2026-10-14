import type { PontoMini } from "../dados";
import { NOMES_TEMA, dataBr } from "../formato";
import type { Metrica } from "../metricas";
import { hrefRota } from "../rota";
import type { Governo, Indicador, Resumo } from "../tipos";
import { MarcadorGoverno } from "./Arte";
import { Duelo, FraseDestaque, montarDuelo } from "./Duelo";
import { MiniGrafico } from "./MiniGrafico";
import { useVisivel } from "./Movimento";

export interface PropsCartao {
  ind: Indicador;
  resumos: Resumo[];
  governos: Governo[];
  metrica: Metrica;
  janela: boolean;
  destacar: boolean;
  mini?: Record<string, PontoMini[]>;
  grande?: boolean;
  onCompartilhar?: () => void;
}

export function Cartao({ ind, resumos, governos, metrica, janela, destacar, mini, grande, onCompartilhar }: PropsCartao) {
  const [ref, visivel] = useVisivel<HTMLElement>();
  const dados = montarDuelo(ind, resumos, governos, metrica, janela);
  const coleta = ind.coletado_em ? dataBr(ind.coletado_em) : "";
  const d = dados.destaque;
  const classe = ["cartao", grande ? "grande" : "", destacar && d.tipo === "melhor" ? `melhor-${d.governo}` : ""].filter(Boolean).join(" ");
  return (
    <article ref={ref} className={classe} aria-labelledby={`t-${ind.indicator_id}`}>
      <a href={hrefRota("indicador", ind.indicator_id)} aria-describedby={`d-${ind.indicator_id}`}>
        <div className="cartao-cabeca">
          <span className="kicker">{NOMES_TEMA[ind.tema] ?? ind.tema}</span>
          <h3 className="cartao-nome" id={`t-${ind.indicator_id}`}>
            {ind.nome}
          </h3>
          <p className="cartao-metrica">{dados.rotulo}</p>
        </div>
        <Duelo dados={dados} destacar={destacar} ativo={visivel} />
        <div className="cartao-tendencia">
          {grande && (
            <p className="legenda-mini" aria-hidden="true">
              <b>Trajetória por {["mensal", "trimestre_movel", "trimestral"].includes(ind.periodicidade) ? "mês" : "ano"} do mandato</b>
              {governos.map((g) => (
                <span key={g.id}>
                  <MarcadorGoverno cor={g.estilo.cor} traco={g.estilo.traco} tamanho={11} />
                  {g.nome}
                </span>
              ))}
            </p>
          )}
          <MiniGrafico ind={ind} series={mini} governos={governos} visivel={visivel} alto={grande} />
          <FraseDestaque d={d} ind={ind} destacar={destacar} />
        </div>
        <div className="cartao-barra">
          <span className="rotulo">Fonte</span>
          {ind.fonte_orgao.replace(/\s*\(.*\)$/, "")} · coleta {coleta}
        </div>
      </a>
      <p className="sr-only" id={`d-${ind.indicator_id}`}>
        {dados.textoBase}
        {destacar && ` ${dados.textoDestaque}`}
      </p>
      {onCompartilhar && (
        <div className="cartao-acoes">
          <button type="button" onClick={onCompartilhar} aria-label={`Compartilhar ${ind.nome} como imagem`} title="Compartilhar como imagem">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      )}
    </article>
  );
}
