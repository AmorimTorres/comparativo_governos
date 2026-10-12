import { Suspense, lazy, useEffect, useState } from "react";
import { carregarDados } from "./dados";
import { dataBr } from "./formato";
import { Home } from "./paginas/Home";
import { hrefRota, useRota } from "./rota";
import type { Dados } from "./tipos";

// Páginas com gráficos (ECharts) carregam sob demanda: a home fica mais leve.
const PaginaIndicador = lazy(() => import("./paginas/Indicador").then((m) => ({ default: m.PaginaIndicador })));
const Metodologia = lazy(() => import("./paginas/Metodologia").then((m) => ({ default: m.Metodologia })));

export function App() {
  const rota = useRota();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarDados().then(setDados).catch((e: Error) => setErro(e.message));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [rota.pagina, rota.id]);

  useEffect(() => {
    if (!dados) return;
    const ind = rota.id ? dados.catalogo.find((i) => i.indicator_id === rota.id) : null;
    document.title = rota.pagina === "indicador" && ind ? `${ind.nome} · Dois governos em dados` : rota.pagina === "metodologia" ? "Metodologia e fontes · Dois governos em dados" : "Dois governos em dados";
  }, [dados, rota]);

  return (
    <>
      <a className="pular" href="#principal">
        Pular para o conteúdo
      </a>
      <header className="topo sobre-verde">
        <div className="conteudo">
          <a className="marca" href={hrefRota("home")}>
            Dois governos em dados
          </a>
          <nav aria-label="Principal">
            <a href={hrefRota("home")} aria-current={rota.pagina === "home" ? "page" : undefined}>
              Indicadores
            </a>
            <a href={hrefRota("metodologia")} aria-current={rota.pagina === "metodologia" ? "page" : undefined}>
              Metodologia e fontes
            </a>
          </nav>
        </div>
      </header>
      <main id="principal" tabIndex={-1}>
        {erro && (
          <div className="conteudo" style={{ padding: "24px 16px" }}>
            <p className="aviso" role="alert">
              Não foi possível carregar os dados: {erro}
            </p>
          </div>
        )}
        {!dados && !erro && (
          <div className="conteudo" style={{ padding: "24px 16px" }} aria-live="polite">
            Carregando dados…
          </div>
        )}
        {dados && rota.pagina === "home" && <Home dados={dados} params={rota.params} />}
        <Suspense fallback={<div className="conteudo" style={{ padding: "24px 16px" }}>Carregando…</div>}>
          {dados && rota.pagina === "indicador" && rota.id && <PaginaIndicador dados={dados} id={rota.id} params={rota.params} />}
          {dados && rota.pagina === "metodologia" && <Metodologia dados={dados} />}
        </Suspense>
      </main>
      <footer className="rodape barra-fonte sobre-azul">
        <div className="conteudo">
          <span className="rotulo">Fontes</span>
          IBGE, Banco Central, INPE, ANP, MTE, MDS, Ministério da Saúde, MJSP, INEP e FAO. Só dados oficiais, com URL e data de coleta registradas.
          {dados?.executadoEm && <> Dados atualizados em {dataBr(dados.executadoEm)}.</>}{" "}
          <a href={hrefRota("metodologia")}>Metodologia, limitações e dados abertos</a>.
        </div>
      </footer>
    </>
  );
}
