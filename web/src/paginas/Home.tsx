import { useEffect, useMemo, useState } from "react";
import { Estrela, InicialGoverno } from "../componentes/Arte";
import { Cartao } from "../componentes/Cartao";
import { Duelo, FraseDestaque, montarDuelo } from "../componentes/Duelo";
import { semMovimento } from "../componentes/Movimento";
import { compartilhar } from "../compartilhar";
import { type Minis, carregarMinis } from "../dados";
import { NOMES_TEMA, mesAno } from "../formato";
import { AJUDA_METRICA, type Metrica, NOMES_METRICA } from "../metricas";
import { atualizarParams, hrefRota } from "../rota";
import type { Dados, Governo, Indicador } from "../tipos";

const METRICAS = Object.keys(NOMES_METRICA) as Metrica[];

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function sortear(ids: string[], exceto?: string): string {
  const opcoes = ids.filter((i) => i !== exceto);
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

const PONTOS_ESTRELA = "0,-9 2.1,-2.9 8.6,-2.8 3.4,1.1 5.3,7.3 0,3.6 -5.3,7.3 -3.4,1.1 -8.6,-2.8 -2.1,-2.9";

function EstrelasArco() {
  const pos = [
    [0.2, 0],
    [0.12, 0.35],
    [0.04, 0.8],
  ];
  return (
    <svg className="estrelas-arco" viewBox="0 0 400 40" aria-hidden="true">
      <g fill="#EA0104" stroke="#FEDD02" strokeWidth={0.9}>
        {pos.flatMap(([x, y], i) => [
          <g key={`e${i}`} transform={`translate(${x * 400},${10 + y * 26})`}>
            <polygon points={PONTOS_ESTRELA} />
          </g>,
          <g key={`d${i}`} transform={`translate(${(1 - x) * 400},${10 + y * 26})`}>
            <polygon points={PONTOS_ESTRELA} />
          </g>,
        ])}
      </g>
    </svg>
  );
}

function Heroi({ dados, governos, metrica, janela, destacar, sorteado }: { dados: Dados; governos: Governo[]; metrica: Metrica; janela: boolean; destacar: boolean; sorteado: Indicador }) {
  const nucleo = dados.catalogo.filter((i) => i.camada === "nucleo");
  const duelo = montarDuelo(sorteado, dados.resumos.filter((r) => r.indicator_id === sorteado.indicator_id), governos, metrica, janela);
  const [ativo, setAtivo] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const [a, b] = governos;
  return (
    <section className="heroi sobre-verde" aria-labelledby="titulo-heroi">
      <div className="conteudo heroi-grade">
        <div className="heroi-texto">
          <span className="heroi-kicker">Dados oficiais . 2019–{new Date().getFullYear()}</span>
          <h1 className="heroi-titulo" id="titulo-heroi">
            Dois governos, <span className="amarelo">os mesmos indicadores</span>
          </h1>
          <p className="heroi-apoio">Mesma série, métrica e janela de tempo</p>
          <ul className="legenda" aria-label="Como ler os cartões">
            {a && (
              <li>
                <InicialGoverno nome={a.nome} />
                <strong>{a.nome}</strong>
                <span className="legenda-periodo">
                  {mesAno(a.inicio)}–{mesAno(a.fim)}
                </span>
              </li>
            )}
            {b && (
              <li>
                <InicialGoverno nome={b.nome} />
                <strong>{b.nome}</strong>
                <span className="legenda-periodo">
                  desde {mesAno(b.inicio)}
                  <span className="sr-only"> (mandato em curso: valores parciais)</span>
                </span>
              </li>
            )}
            {destacar && (
              <li>
                <Estrela tamanho={18} />
                <strong>Melhor resultado</strong>
              </li>
            )}
          </ul>
          <button type="button" className="botao amarelo botao-cta" onClick={() => document.getElementById("indicadores")?.scrollIntoView({ behavior: semMovimento() ? "auto" : "smooth" })}>
            Ver os {nucleo.length} indicadores <span className="seta-botao" aria-hidden="true">↓</span>
          </button>
        </div>

        <div className="palco" aria-labelledby="palco-nome">
          <EstrelasArco />
          <p className="palco-kicker">
            <span className="sr-only">Card sorteado: </span>
            {NOMES_TEMA[sorteado.tema]}
          </p>
          <h2 className="palco-nome" id="palco-nome">
            <a href={hrefRota("indicador", sorteado.indicator_id)}>{sorteado.nome}</a>
          </h2>
          <p className="palco-metrica">{duelo.rotulo}</p>
          <Duelo dados={duelo} destacar={destacar} ativo={ativo} key={sorteado.indicator_id} />
          <FraseDestaque d={duelo.destaque} ind={sorteado} destacar={destacar} />
          <p className="sr-only" aria-live="polite">
            {sorteado.nome}. {duelo.textoBase} {destacar && duelo.textoDestaque}
          </p>
          <div className="palco-acoes">
            <a className="botao amarelo botao-pequeno" href={hrefRota("indicador", sorteado.indicator_id)}>
              Ver gráfico e fontes <span className="seta-botao" aria-hidden="true">→</span>
            </a>
            <button type="button" className="botao contorno botao-pequeno" onClick={() => atualizarParams({ h: sortear(nucleo.map((i) => i.indicator_id), sorteado.indicator_id) })}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4v14m0 0-3-3m3 3 3-3M17 20V6m0 0-3 3m3-3 3 3" fill="none" stroke="currentColor" strokeWidth="2.4" />
              </svg>
              Sortear outro
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Home({ dados, params }: { dados: Dados; params: URLSearchParams }) {
  const metrica = (METRICAS.includes(params.get("m") as Metrica) ? params.get("m") : "padrao") as Metrica;
  const janela = params.get("j") !== "0";
  const tema = params.get("t") ?? "";
  const busca = params.get("q") ?? "";
  const destacar = params.get("d") !== "0";
  const complementares = params.get("c") === "1";
  const [aviso, setAviso] = useState("");
  const [minis, setMinis] = useState<Minis | null>(null);

  useEffect(() => {
    carregarMinis().then(setMinis).catch(() => setMinis({}));
  }, []);

  const governos = dados.comparados.map((id) => dados.governos.find((g) => g.id === id)!).filter(Boolean);
  const nucleo = dados.catalogo.filter((i) => i.camada === "nucleo");
  // Sorteio do destaque do topo: fica fixo na sessão (e no link, se o usuário sortear outro).
  const [sorteioInicial] = useState(() => sortear(nucleo.map((i) => i.indicator_id)));
  const sorteado = nucleo.find((i) => i.indicator_id === params.get("h")) ?? nucleo.find((i) => i.indicator_id === sorteioInicial)!;

  const temas = [...new Set(dados.catalogo.filter((i) => i.camada !== "contexto").map((i) => i.tema))];
  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim());
    return dados.catalogo
      .filter((i) => i.camada === "nucleo" || (complementares && i.camada === "reserva"))
      .filter((i) => !tema || i.tema === tema)
      .filter((i) => !q || normalizar(`${i.nome} ${i.descricao_curta} ${i.fonte_orgao} ${i.fonte_tabela_ou_serie} ${NOMES_TEMA[i.tema]}`).includes(q))
      .sort((a, b) => a.ordem - b.ordem);
  }, [dados.catalogo, busca, tema, complementares]);

  const porTema = temas
    .map((t) => ({ t, inds: visiveis.filter((i) => i.tema === t) }))
    .filter((x) => x.inds.length);
  const contexto = dados.catalogo.filter((i) => i.camada === "contexto");

  async function onCompartilhar(id: string) {
    const ind = dados.catalogo.find((i) => i.indicator_id === id)!;
    setAviso("Gerando imagem…");
    try {
      const r = await compartilhar(ind, dados.resumos.filter((x) => x.indicator_id === id), governos, metrica, janela, destacar);
      setAviso(r === "baixado" ? `Imagem de ${ind.nome} baixada.` : `Imagem de ${ind.nome} pronta para compartilhar.`);
    } catch (e) {
      setAviso(`Não foi possível gerar a imagem: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <Heroi dados={dados} governos={governos} metrica={metrica} janela={janela} destacar={destacar} sorteado={sorteado} />

      <div className="conteudo">
        <p className="texto-longo intro">
          Compare os governos Bolsonaro (jan/2019–dez/2022) e Lula 3 (desde jan/2023) com dados de órgãos oficiais. O mandato de Lula está em curso, então
          todo valor dele é <strong>parcial</strong>. Quando há consenso sobre a direção desejável (menos desemprego, mais renda), a estrela marca o governo
          com o melhor resultado <em>naquele dado</em>, na métrica e na janela escolhidas. Não há placar geral: os indicadores têm pesos, causas e defasagens
          diferentes, e choques externos, como a pandemia em 2020–2021 e as secas e enchentes de 2023–2024, aparecem como eventos de contexto nos gráficos.
          Veja <a href={hrefRota("metodologia")}>como cada dado é atribuído a cada governo</a>.
        </p>

        <form className="controles" role="search" aria-label="Filtrar indicadores" onSubmit={(e) => e.preventDefault()} id="indicadores">
          <div className="campo-busca">
            <label htmlFor="busca" className="pequeno">
              Buscar indicador
            </label>
            <input id="busca" type="search" placeholder="gasolina, homicídios, PIB…" value={busca} onChange={(e) => atualizarParams({ q: e.target.value })} />
          </div>
          <div className="grupo-metrica">
            <span className="pequeno" id="rotulo-metrica">
              Métrica exibida
            </span>
            <div className="segmentos" role="group" aria-labelledby="rotulo-metrica">
              {METRICAS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="segmento"
                  aria-pressed={metrica === m}
                  title={AJUDA_METRICA[m]}
                  onClick={() => atualizarParams({ m: m === "padrao" ? undefined : m })}
                >
                  {NOMES_METRICA[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="linha-controles">
            <label className="alternador">
              <input type="checkbox" checked={destacar} onChange={(e) => atualizarParams({ d: e.target.checked ? undefined : "0" })} />
              Destacar o melhor resultado
            </label>
            <label className="alternador">
              <input type="checkbox" checked={janela} onChange={(e) => atualizarParams({ j: e.target.checked ? undefined : "0" })} />
              Só a janela comum (mesmos meses ou anos de cada mandato)
            </label>
            <label className="alternador">
              <input type="checkbox" checked={complementares} onChange={(e) => atualizarParams({ c: e.target.checked ? "1" : undefined })} />
              Incluir indicadores complementares
            </label>
          </div>
        </form>
      </div>

      <div className="barra-temas">
        <div className="conteudo">
          <div className="chips" role="group" aria-label="Filtrar por tema">
            <button type="button" className="chip" aria-pressed={!tema} onClick={() => atualizarParams({ t: undefined })}>
              Todos
            </button>
            {temas.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tema === t} onClick={() => atualizarParams({ t: tema === t ? undefined : t })}>
                {NOMES_TEMA[t] ?? t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="conteudo">
        <p className="sr-only" aria-live="polite">
          {visiveis.length} indicadores exibidos. {aviso}
        </p>
        {aviso && (
          <p className="pequeno aviso-flutuante" aria-hidden="true">
            {aviso}
          </p>
        )}

        {porTema.length === 0 && <p className="aviso" style={{ marginTop: 16 }}>Nenhum indicador encontrado para “{busca}”. Tente outro termo ou limpe os filtros.</p>}

        {porTema.map(({ t, inds }) => (
          <section key={t} className="secao-tema" aria-labelledby={`tema-${t}`}>
            <h2 id={`tema-${t}`}>
              <Estrela tamanho={22} />
              {NOMES_TEMA[t] ?? t}
              <span className="contagem">
                {inds.length} {inds.length === 1 ? "indicador" : "indicadores"}
              </span>
            </h2>
            <div className="grade">
              {inds.map((ind, k) => (
                <Cartao
                  key={ind.indicator_id}
                  ind={ind}
                  resumos={dados.resumos.filter((r) => r.indicator_id === ind.indicator_id)}
                  governos={governos}
                  metrica={metrica}
                  janela={janela}
                  destacar={destacar}
                  mini={minis?.[ind.indicator_id]}
                  grande={k === 0 && inds.length >= 3}
                  onCompartilhar={() => onCompartilhar(ind.indicator_id)}
                />
              ))}
            </div>
          </section>
        ))}

        {contexto.length > 0 && !tema && !busca && (
          <section className="bloco" aria-labelledby="contexto">
            <h2 id="contexto">Contexto, sem comparação de desempenho</h2>
            <ul>
              {contexto.map((i) => (
                <li key={i.indicator_id}>
                  <a href={hrefRota("indicador", i.indicator_id)}>{i.nome}</a>: {i.descricao_curta}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
