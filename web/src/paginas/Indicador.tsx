import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AnaliseFeminicidio } from "../componentes/AnaliseFeminicidio";
import { Estrela, MarcadorGoverno } from "../componentes/Arte";
import { Duelo, FraseDestaque, montarDuelo } from "../componentes/Duelo";
import { Grafico } from "../componentes/Grafico";
import { compartilhar } from "../compartilhar";
import { carregarSerie, urlCsvIndicador } from "../dados";
import { NOMES_PERIODICIDADE, NOMES_TEMA, dataBr, mesAno, rotuloPeriodo, valorComUnidade } from "../formato";
import { descricaoAgregacaoAnual, descricaoGrafico, opcaoBarras, opcaoCalendario, opcaoMesMandato } from "../graficos";
import { AJUDA_METRICA, DIRECAO, type Metrica, NOMES_METRICA, destaque, valorCartao, variacaoTexto } from "../metricas";
import { atualizarParams, hrefRota } from "../rota";
import type { Dados, Governo, Indicador, Observacao, Resumo } from "../tipos";

type Visao = "mandato" | "data" | "anual";
const VISOES: Record<Visao, string> = { mandato: "Por mês do mandato", data: "Por data", anual: "Barras anuais" };
const METRICAS = Object.keys(NOMES_METRICA) as Metrica[];

const LINHAS: Array<{ m: Exclude<Metrica, "padrao">; nome: string }> = [
  { m: "media", nome: "Média" },
  { m: "acumulado", nome: "Acumulado" },
  { m: "fim", nome: "Último valor" },
  { m: "inicio_fim", nome: "Início → fim" },
  { m: "pico", nome: "Pico (maior valor)" },
  { m: "vale", nome: "Vale (menor valor)" },
];

/** Todas as métricas lado a lado, com o melhor resultado de cada linha marcado. */
function Comparacao({ ind, resumos, governos, janela, destacar }: { ind: Indicador; resumos: Resumo[]; governos: Governo[]; janela: boolean; destacar: boolean }) {
  const presentes = governos.filter((g) => resumos.some((r) => r.governo === g.id));
  const linhas = LINHAS.filter((l) => l.m !== "acumulado" || ind.acumulado);
  const p = (per: string) => rotuloPeriodo(per, ind.periodicidade);
  return (
    <section className="comparacao" aria-labelledby="h-comp">
      <h2 id="h-comp">Todas as métricas</h2>
      <div className="tabela-rolagem">
        <table>
          <caption className="sr-only">
            {ind.nome}: métricas de cada governo{janela ? " na janela comum" : ""}
            {destacar ? ", com o melhor resultado de cada linha marcado" : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">Métrica</th>
              {presentes.map((g) => {
                const r = resumos.find((x) => x.governo === g.id)!;
                const J = janela && r.n_janela_comum > 0;
                return (
                  <th scope="col" key={g.id} style={{ borderTopColor: g.estilo.cor }}>
                    <span className="th-gov">
                      <MarcadorGoverno cor={g.estilo.cor} marcador={g.estilo.marcador} tamanho={12} />
                      {g.nome}
                      {g.em_curso && <span className="pill-parcial">PARCIAL</span>}
                    </span>
                    <span className="th-janela">
                      {J ? r.periodo_coberto_janela_comum : r.periodo_coberto} · {J ? r.n_janela_comum : r.n_observacoes} obs.
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ m, nome }) => {
              const valores = presentes.map((g) => ({ g, v: valorCartao(resumos.find((x) => x.governo === g.id)!, ind, m, janela) }));
              const d = destaque(ind, valores, m);
              return (
                <tr key={m}>
                  <th scope="row">{nome}</th>
                  {valores.map(({ g, v }) => {
                    const melhor = destacar && d.tipo === "melhor" && d.governo === g.id;
                    let principal: string;
                    let detalhe = "";
                    if (m === "inicio_fim") {
                      principal = `${valorComUnidade(v.valorInicio ?? null, ind, v.qualificadorInicio)} → ${valorComUnidade(v.valor, ind, v.qualificador)}`;
                      detalhe = variacaoTexto(v, ind);
                    } else {
                      principal = v.valor === null ? "não calculada" : valorComUnidade(v.valor, ind, v.qualificador, v.composto);
                      detalhe = v.periodoRef ? p(v.periodoRef) : "";
                    }
                    return (
                      <td key={g.id} className={melhor ? "melhor" : undefined}>
                        {melhor && (
                          <span className="selo-celula">
                            <Estrela tamanho={13} /> Melhor
                          </span>
                        )}
                        <span className="valor-celula">{principal}</span>
                        {detalhe && <span className="detalhe-celula">{detalhe}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pequeno" style={{ marginTop: 6 }}>
        {destacar && DIRECAO[ind.sentido_desejavel]
          ? `Direção desejável: ${DIRECAO[ind.sentido_desejavel]}. Em "Início → fim", a estrela vai para a variação mais favorável; o valor inicial reflete também o governo anterior. Empates na precisão exibida ficam sem estrela.`
          : destacar
            ? "Sem direção consensual para este indicador: o painel não aponta melhor."
            : ""}{" "}
        {resumos.map((r) => r.observacao).filter(Boolean).join(" ")}
      </p>
    </section>
  );
}

function TabelaDados({ ind, obs, governos }: { ind: Indicador; obs: Observacao[]; governos: Governo[] }) {
  const nome = (id: string) => governos.find((g) => g.id === id)?.nome ?? "Antes de 2019";
  const linhas = [...obs].reverse();
  const mensal = ["mensal", "trimestre_movel", "trimestral"].includes(ind.periodicidade);
  return (
    <details>
      <summary>Tabela de dados ({obs.length} períodos)</summary>
      <div className="tabela-rolagem">
        <table>
          <caption className="sr-only">Valores de {ind.nome} por período, com o governo atribuído</caption>
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Valor</th>
              <th scope="col">Governo</th>
              <th scope="col">{mensal ? "Mês do mandato" : "Ano do mandato"}</th>
              <th scope="col">Observação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((o) => (
              <tr key={o.periodo}>
                <th scope="row" style={{ fontFamily: "inherit", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                  {rotuloPeriodo(o.periodo, ind.periodicidade)}
                </th>
                <td className="num">{valorComUnidade(o.valor, ind, o.qualificador)}</td>
                <td>{nome(o.governo)}</td>
                <td className="num">{(mensal ? o.mes_do_mandato : o.ano_do_mandato) ?? "—"}</td>
                <td>{[o.parcial ? "parcial" : "", o.observacao].filter(Boolean).join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function PaginaIndicador({ dados, id, params }: { dados: Dados; id: string; params: URLSearchParams }) {
  const ind = dados.catalogo.find((i) => i.indicator_id === id);
  const [obs, setObs] = useState<Observacao[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const visao = (Object.keys(VISOES).includes(params.get("v") ?? "") ? params.get("v") : "mandato") as Visao;
  const eventosLigados = params.get("e") !== "0";
  const janela = params.get("j") !== "0";
  const metrica = (METRICAS.includes(params.get("m") as Metrica) ? params.get("m") : "padrao") as Metrica;
  const destacar = params.get("d") !== "0";
  const [ativo, setAtivo] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setObs(null);
    carregarSerie(id).then(setObs).catch((e: Error) => setErro(e.message));
  }, [id]);

  const governos = dados.comparados.map((g) => dados.governos.find((x) => x.id === g)!).filter(Boolean);
  const resumos = dados.resumos.filter((r) => r.indicator_id === id);
  const eventos = dados.eventos.filter((e) => e.indicadores_afetados.includes(id));
  const irmaos = ind ? dados.catalogo.filter((i) => i.grupo === ind.grupo && i.indicator_id !== id) : [];

  const opcao = useMemo(() => {
    if (!ind || !obs) return null;
    if (visao === "data") return opcaoCalendario(ind, obs, governos, dados.eventos, eventosLigados);
    if (visao === "anual") return opcaoBarras(ind, obs, governos);
    return opcaoMesMandato(ind, obs, governos, dados.eventos, eventosLigados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ind, obs, visao, eventosLigados]);

  if (!ind) {
    return (
      <div className="conteudo" style={{ padding: "24px 16px" }}>
        <p className="aviso">
          Indicador “{id}” não encontrado. <a href={hrefRota("home")}>Ver todos os indicadores</a>.
        </p>
      </div>
    );
  }

  async function onCompartilhar() {
    setAviso("Gerando imagem…");
    try {
      const r = await compartilhar(ind!, resumos, governos, metrica, janela, destacar);
      setAviso(r === "baixado" ? "Imagem baixada." : "Imagem pronta para compartilhar.");
    } catch (e) {
      setAviso(`Não foi possível gerar a imagem: ${(e as Error).message}`);
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link copiado com a visão e os filtros atuais.");
    } catch {
      setAviso("Não foi possível copiar. Copie o endereço na barra do navegador.");
    }
  }

  const camadaAviso =
    ind.camada === "contexto"
      ? "Este indicador é contexto: mostra um choque externo e não serve para comparar o desempenho dos governos."
      : ind.camada === "reserva"
        ? "Indicador complementar."
        : "";
  const duelo = montarDuelo(ind, resumos, governos, metrica, janela);
  // Métricas que mudam o número para este indicador (acumulado só onde faz sentido).
  const metricasValidas = METRICAS.filter((m) => m !== "acumulado" || ind.acumulado);

  return (
    <>
      <section className="cabecalho-ind sobre-verde" aria-labelledby="titulo-ind">
        <div className="conteudo">
          <a className="voltar" href={hrefRota("home")}>
            ← Todos os indicadores
          </a>
          <div style={{ marginTop: 10 }}>
            <span className="kicker">
              {NOMES_TEMA[ind.tema]} • {NOMES_PERIODICIDADE[ind.periodicidade]}
            </span>
          </div>
          <h1 id="titulo-ind">{ind.nome}</h1>
          <p className="apoio">{ind.descricao_curta}</p>
          <div className="palco palco-ind">
            <div className="segmentos claro" role="group" aria-label="Métrica dos números e da imagem">
              {metricasValidas.map((m) => (
                <button key={m} type="button" className="segmento" aria-pressed={metrica === m} title={AJUDA_METRICA[m]} onClick={() => atualizarParams({ m: m === "padrao" ? undefined : m })}>
                  {NOMES_METRICA[m]}
                </button>
              ))}
            </div>
            <p className="palco-metrica">{duelo.rotulo}</p>
            <Duelo dados={duelo} destacar={destacar} ativo={ativo} />
            <FraseDestaque d={duelo.destaque} ind={ind} destacar={destacar} />
            <p className="sr-only" aria-live="polite">
              {duelo.textoBase} {destacar && duelo.textoDestaque}
            </p>
          </div>
        </div>
      </section>

      <div className="conteudo">
        {camadaAviso && (
          <p className="aviso" style={{ marginTop: 16 }}>
            {camadaAviso}
          </p>
        )}
        {irmaos.length > 0 && (
          <nav className="grupo-links" aria-label="Indicadores relacionados">
            <span className="pequeno" style={{ alignSelf: "center" }}>
              Ver também:
            </span>
            {irmaos.map((i) => (
              <a key={i.indicator_id} className="botao" href={hrefRota("indicador", i.indicator_id, { v: params.get("v") ?? undefined })}>
                {i.nome}
              </a>
            ))}
          </nav>
        )}

        {ind.indicator_id === "feminicidios" && <AnaliseFeminicidio dados={dados} governos={governos} metrica={metrica} janela={janela} destacar={destacar} />}

        <div className="controles">
          <div className="chips" role="group" aria-label="Visão do gráfico">
            {(Object.keys(VISOES) as Visao[]).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={visao === v} onClick={() => atualizarParams({ v: v === "mandato" ? undefined : v })}>
                {VISOES[v]}
              </button>
            ))}
          </div>
          <div className="linha-controles">
            {visao !== "anual" && (
              <label className="alternador">
                <input type="checkbox" checked={eventosLigados} onChange={(e) => atualizarParams({ e: e.target.checked ? undefined : "0" })} />
                Mostrar eventos de contexto
              </label>
            )}
            <label className="alternador">
              <input type="checkbox" checked={janela} onChange={(e) => atualizarParams({ j: e.target.checked ? undefined : "0" })} />
              Números só na janela comum
            </label>
            <label className="alternador">
              <input type="checkbox" checked={destacar} onChange={(e) => atualizarParams({ d: e.target.checked ? undefined : "0" })} />
              Destacar o melhor resultado
            </label>
          </div>
        </div>

        <div className="painel">
          {erro && <p className="aviso">Não foi possível carregar a série: {erro}</p>}
          {!obs && !erro && <p aria-live="polite">Carregando série…</p>}
          {obs && opcao && <Grafico opcao={opcao} descricao={descricaoGrafico(ind, obs, governos)} id="grafico" />}
          <p className="pequeno" style={{ margin: "6px 4px 0" }}>
            {visao === "mandato" &&
              "Cada linha começa no 1º mês (ou ano) do mandato. Marcadores vazados indicam dado parcial, preliminar, fora das médias ou valor abaixo do limite de divulgação (desenhado no próprio limite). "}
            {visao === "data" && "Faixas coloridas marcam os mandatos; a linha pontilhada cinza é o período anterior a 2019. "}
            {visao === "anual" && `${descricaoAgregacaoAnual(ind)} Anos com * estão incompletos. Barras listradas: ${governos[1]?.nome}. `}
            {DIRECAO[ind.sentido_desejavel] && `Direção desejável: ${DIRECAO[ind.sentido_desejavel]}.`}
          </p>
        </div>

        <Comparacao ind={ind} resumos={resumos} governos={governos} janela={janela} destacar={destacar} />

        <div className="linha-controles" style={{ margin: "4px 0 16px" }}>
          <button type="button" className="botao primario" onClick={onCompartilhar}>
            Compartilhar como imagem
          </button>
          <a className="botao" href={urlCsvIndicador(id)} download={`${id}.csv`}>
            Baixar CSV
          </a>
          <button type="button" className="botao" onClick={copiarLink}>
            Copiar link desta visão
          </button>
          <span role="status" className="pequeno">
            {aviso}
          </span>
        </div>

        <div className="info">
          <section aria-labelledby="h-fonte">
            <h2 id="h-fonte">Fonte</h2>
            <p>
              <strong>{ind.fonte_orgao}</strong>. {ind.fonte_tabela_ou_serie}.
            </p>
            <p>
              <a href={ind.url_fonte} rel="noopener" target="_blank">
                Página da fonte
              </a>{" "}
              ·{" "}
              <a href={ind.url_api} rel="noopener" target="_blank">
                Endereço dos dados
              </a>
            </p>
            <p className="pequeno">
              Coleta em {dataBr(ind.coletado_em)} · último período: {rotuloPeriodo(ind.ultimo_periodo, ind.periodicidade)} · nível: {ind.nivel_geografico}
            </p>
          </section>
          <section aria-labelledby="h-met">
            <h2 id="h-met">Metodologia</h2>
            <p>{ind.metodologia_resumo}</p>
            <p className="pequeno">
              Atribuição ao governo:{" "}
              {ind.regra_atribuicao === "fim" ? "pelo último mês do período." : "pela maior parte do período (ponto médio)."}{" "}
              <a href={hrefRota("metodologia")}>Regras completas</a>.
            </p>
          </section>
          <section aria-labelledby="h-ress">
            <h2 id="h-ress">Ressalvas</h2>
            <p>{ind.ressalvas}</p>
            <p className="pequeno">
              Quebra metodológica: {ind.quebra_metodologica}. Correlação não implica causalidade: os números mostram o que aconteceu em cada período, não
              quem causou.
            </p>
          </section>
        </div>

        {eventos.length > 0 && (
          <section className="bloco" aria-labelledby="h-ev" style={{ marginBottom: 16 }}>
            <h2 id="h-ev">Eventos de contexto</h2>
            <ul className="lista-eventos">
              {eventos.map((e) => (
                <li key={e.evento + e.data_inicio}>
                  <strong>{e.evento}</strong> ({e.data_fim ? `${mesAno(e.data_inicio)}–${mesAno(e.data_fim)}` : dataBr(e.data_inicio)}). {e.descricao}{" "}
                  {e.fonte_url.map((u, k) => (
                    <a key={u} href={u} rel="noopener" target="_blank">
                      fonte{e.fonte_url.length > 1 ? ` ${k + 1}` : ""}
                    </a>
                  )).reduce<ReactNode[]>((acc, el, k) => (k ? [...acc, " · ", el] : [el]), [])}
                </li>
              ))}
            </ul>
          </section>
        )}

        {obs && <TabelaDados ind={ind} obs={obs} governos={governos} />}
      </div>
      <div className="barra-fonte sobre-azul" style={{ marginTop: 24 }}>
        <div className="conteudo" style={{ padding: "8px 16px" }}>
          <span className="rotulo">Fonte</span>
          {ind.fonte_orgao} · {ind.fonte_tabela_ou_serie} · último dado: {rotuloPeriodo(ind.ultimo_periodo, ind.periodicidade)} · coleta {dataBr(ind.coletado_em)}
        </div>
      </div>
    </>
  );
}
