import { MarcadorGoverno } from "../componentes/Arte";
import { NOMES_PERIODICIDADE, NOMES_TEMA, dataBr, mesAno } from "../formato";
import { hrefRota } from "../rota";
import type { Dados } from "../tipos";

// Responsável pelo painel: preencha antes de publicar.
const MANTENEDOR = {
  nome: "André Amorim Torres - Dreds",
  contato: "amorimtorresandre@gmail.com",
  repositorio: "https://github.com/AmorimTorres/comparativo_governos",
};

const DESCARTADOS: Array<[string, string]> = [
  [
    "Cobertura vacinal (PNI)",
    "O sistema de registro mudou exatamente na troca de governo: o TabNet do SI-PNI vai até 2022 e, de 2023 em diante, só existe o painel da RNDS, com outra base e outros denominadores. Não há série única comparável.",
  ],
  ["Segurança alimentar do IBGE (EBIA)", "Não há dado oficial do IBGE entre 2019 e 2022 (só a POF 2017–2018 e a PNAD Contínua de 2023 e 2024)."],
  ["Pesquisa VIGISAN (Rede PENSSAN)", "Pesquisa não governamental. Pode ser citada como referência, mas não entra como série do painel."],
  ["Indicador Criança Alfabetizada", "Criado em 2023, sem equivalente anterior."],
  ["Farmácia Popular", "Não foi localizada série oficial aberta e contínua."],
  ["Minha Casa Minha Vida", "O programa foi substituído pelo Casa Verde e Amarela em 2021–2022, com outras modalidades; não há série contínua oficial."],
  ["Anuário do FBSP e Atlas da Violência", "Publicações não governamentais ou secundárias: usadas só como referência cruzada."],
];

export function Metodologia({ dados }: { dados: Dados }) {
  const porTema = Object.keys(NOMES_TEMA)
    .map((t) => ({ t, inds: dados.catalogo.filter((i) => i.tema === t).sort((a, b) => a.ordem - b.ordem) }))
    .filter((x) => x.inds.length);
  return (
    <>
      <section className="cabecalho-ind sobre-verde" aria-labelledby="titulo-met">
        <div className="conteudo">
          <span className="kicker">Como o painel funciona</span>
          <h1 id="titulo-met">Metodologia e fontes</h1>
          <p className="apoio">Regras, limitações e dados abertos</p>
        </div>
      </section>
      <div className="conteudo texto-longo">
        <h2>Princípios</h2>
        <ul>
          <li>Só dados de órgãos oficiais, baixados por um programa que registra a URL, a data de coleta e o hash de cada arquivo. Nenhum número é digitado à mão.</li>
          <li>Mesma série, mesma métrica e mesma janela de tempo para os dois governos.</li>
          <li>O mandato de Lula 3 está em curso: tudo dele é marcado como parcial.</li>
          <li>
            Melhor resultado por dado, sem placar geral. Quando a direção desejável é consensual (por exemplo, menos desemprego ou mais renda), uma estrela
            marca o governo com o melhor número naquela métrica e naquela janela. Indicadores sem consenso sobre a direção (preço da gasolina, salário mínimo,
            Selic, número de famílias no Bolsa Família) e os de contexto ficam sem estrela. O destaque pode ser desligado.
          </li>
          <li>Contexto obrigatório: choques externos como a pandemia, guerras, secas e enchentes aparecem como camada de eventos, cada um com fonte oficial.</li>
        </ul>

        <h2>Como o melhor resultado é escolhido</h2>
        <ul>
          <li>A comparação usa exatamente os números exibidos: mesma métrica, mesma janela (a janela comum, por padrão) e mesma precisão. Números iguais na precisão exibida contam como empate, sem estrela.</li>
          <li>
            Em <strong>pico</strong> e <strong>vale</strong>, vale a mesma direção do indicador: se menor é melhor, o pico mais baixo e o vale mais baixo
            ganham a estrela. Em <strong>início → fim</strong>, ganha a variação mais favorável, porque o valor inicial de cada mandato reflete também o
            governo anterior.
          </li>
          <li>Valores abaixo do limite de divulgação (como “menos de 2,5%” da FAO) só decidem quando o outro valor está no limite ou acima dele.</li>
          <li>
            O governo Lula 3 está em curso: a estrela dele vale para o período já coberto e pode mudar até o fim do mandato. Não há contagem de estrelas,
            porque os indicadores têm pesos, causas e defasagens diferentes.
          </li>
        </ul>

        <h2>Correlação não é causalidade</h2>
        <p>
          Os números mostram o que aconteceu durante cada mandato, não quem causou. Muitos indicadores dependem de fatores fora do controle do governo federal
          (preços internacionais, clima, ciclos econômicos, decisões de estados e municípios, do Congresso e do Banco Central, que tem autonomia legal desde
          2021) e de políticas de governos anteriores, que produzem efeitos com atraso.
        </p>

        <h2>Como cada dado é atribuído a um governo</h2>
        <h3>Mandatos</h3>
        <ul>
          {dados.governos.map((g) => (
            <li key={g.id}>
              <MarcadorGoverno cor={g.estilo.cor} marcador={g.estilo.marcador} tamanho={12} /> <strong>{g.nome_completo}</strong>: {dataBr(g.inicio)} a{" "}
              {g.em_curso ? `${dataBr(g.fim)} (fim previsto; em curso)` : dataBr(g.fim)}. Linha {g.estilo.traco}, marcador {g.estilo.marcador}.
            </li>
          ))}
        </ul>
        <h3>Regras</h3>
        <ul>
          <li>
            <strong>Dados mensais:</strong> cada mês pertence a quem governava naquele mês. Janeiro de 2023 é o mês 1 do governo Lula 3. O “mês do mandato” vai de 1
            a 48 e permite sobrepor as duas linhas.
          </li>
          <li>
            <strong>Trimestre móvel da PNAD (desemprego):</strong> o IBGE identifica cada trimestre móvel pelo mês final, e o painel faz o mesmo. Os dois primeiros
            trimestres móveis de cada mandato ainda incluem meses do governo anterior e ficam marcados como “transição”.
          </li>
          <li>
            <strong>Acumulados em 12 meses</strong> (IPCA em 12 meses, resultado primário): nos 11 primeiros meses de cada mandato incluem meses do governo
            anterior e são marcados. Para comparar mandatos, o painel compõe as variações mensais dentro de cada mandato.
          </li>
          <li>
            <strong>Dados trimestrais e anuais:</strong> atribuição direta pelo trimestre ou ano civil.
          </li>
          <li>
            <strong>PRODES (agosto a julho):</strong> o ano PRODES AAAA vai de agosto de AAAA−1 a julho de AAAA e é atribuído ao governo que tem 7 dos 12 meses,
            ou seja, o que governava em janeiro de AAAA. PRODES 2019 e 2023 incluem 5 meses do governo anterior e ficam marcados. O DETER mensal permite
            atribuir mês a mês.
          </li>
          <li>
            <strong>Médias de três anos da FAO:</strong> cada triênio vai para o governo com 2 dos 3 anos; triênios mistos ficam marcados.
          </li>
          <li>
            <strong>IDEB:</strong> atribuído pelo ano de aplicação da prova.
          </li>
        </ul>
        <h3>Métricas</h3>
        <ul>
          <li><strong>Média do mandato:</strong> média simples das observações do período.</li>
          <li><strong>Acumulado:</strong> para variações percentuais (inflação, PIB), a composição das variações; para fluxos (empregos, área desmatada, focos, vítimas), a soma.</li>
          <li><strong>Início → fim:</strong> primeira e última observação do período.</li>
          <li><strong>Pico e vale:</strong> maior e menor valor do período, com a data.</li>
          <li>
            <strong>Janela comum</strong> (ligada por padrão): compara só os meses ou anos do mandato que existem para os dois governos. Por exemplo, se há dados de
            44 meses do governo Lula 3, compara-se com os 44 primeiros meses do governo Bolsonaro.
          </li>
          <li>Valores do ano em curso, meses incompletos e meses afetados por mudanças de programa ficam fora das médias e aparecem com marcador vazado.</li>
        </ul>

        <h2>Limitações</h2>
        <ul>
          <li>O governo Lula 3 está em curso: médias e acumulados podem mudar até o fim do mandato.</li>
          <li>Indicadores anuais têm defasagem (pobreza e mortalidade, por exemplo) e cobrem menos anos do governo atual.</li>
          <li>Fontes revisam dados: PIB, PNAD Contínua (reponderada em 2021 e em 2025), FAO (revisa a série inteira a cada edição) e dados preliminares de saúde. Vale a versão da data de coleta.</li>
          <li>Registros de segurança pública dependem das secretarias estaduais e da forma de classificar crimes, que muda com o tempo.</li>
          <li>Indicadores nacionais escondem diferenças entre regiões e grupos sociais.</li>
          <li>O desmatamento PRODES do ano em curso só é divulgado no fim do ano; o painel mostra o que já foi publicado.</li>
        </ul>

        <h2>Indicadores e fontes</h2>
        {porTema.map(({ t, inds }) => (
          <section key={t}>
            <h3>{NOMES_TEMA[t]}</h3>
            <ul>
              {inds.map((i) => (
                <li key={i.indicator_id}>
                  <a href={hrefRota("indicador", i.indicator_id)}>{i.nome}</a> ({NOMES_PERIODICIDADE[i.periodicidade]}
                  {i.camada !== "nucleo" ? `, ${i.camada === "reserva" ? "complementar" : "contexto"}` : ""}): {i.fonte_orgao}, {i.fonte_tabela_ou_serie}.{" "}
                  <a href={i.url_fonte} rel="noopener" target="_blank">
                    Fonte
                  </a>
                  .
                </li>
              ))}
            </ul>
          </section>
        ))}

        <h2>Indicadores avaliados e descartados</h2>
        <ul>
          {DESCARTADOS.map(([n, m]) => (
            <li key={n}>
              <strong>{n}:</strong> {m}
            </li>
          ))}
        </ul>

        <h2>Eventos de contexto</h2>
        <ul>
          {dados.eventos.map((e) => (
            <li key={e.evento + e.data_inicio}>
              <strong>{e.evento}</strong> ({e.data_fim ? `${mesAno(e.data_inicio)}–${mesAno(e.data_fim)}` : dataBr(e.data_inicio)}): {e.descricao}{" "}
              {e.fonte_url.map((u, k) => (
                <span key={u}>
                  {k > 0 && " · "}
                  <a href={u} rel="noopener" target="_blank">
                    fonte{e.fonte_url.length > 1 ? ` ${k + 1}` : ""}
                  </a>
                </span>
              ))}
            </li>
          ))}
        </ul>

        <h2>Dados abertos e código</h2>
        <p>Todos os dados processados podem ser baixados:</p>
        <ul>
          <li><a href="./data/catalogo_indicadores.csv">catalogo_indicadores.csv</a>: metadados, fontes e ressalvas de cada indicador.</li>
          <li><a href="./data/series.csv">series.csv</a>: todas as observações, com governo, mês e ano do mandato, data de coleta e URL da fonte.</li>
          <li><a href="./data/resumos_por_governo.csv">resumos_por_governo.csv</a>: médias, acumulados, picos e vales por governo.</li>
          <li><a href="./data/eventos_contexto.csv">eventos_contexto.csv</a>: eventos de contexto com fontes.</li>
        </ul>
        <p>
          O programa que baixa e trata os dados é aberto e refaz tudo com um único comando (<code>make data</code>).
          {MANTENEDOR.repositorio ? (
            <>
              {" "}
              Código: <a href={MANTENEDOR.repositorio}>{MANTENEDOR.repositorio}</a>.
            </>
          ) : (
            " O endereço do repositório será publicado aqui."
          )}
        </p>

        <h2>Quem mantém este painel</h2>
        <p>
          {MANTENEDOR.nome
            ? `${MANTENEDOR.nome}${MANTENEDOR.contato ? ` (${MANTENEDOR.contato})` : ""}.`
            : "Responsável a definir antes da publicação."}{" "}
          Encontrou um erro? Informe o indicador, o período e a fonte, que a correção é feita no programa de coleta, nunca à mão.
        </p>
        <p className="pequeno" style={{ marginBottom: 32 }}>
          Dados atualizados em {dataBr(dados.executadoEm)}.
        </p>
      </div>
    </>
  );
}
