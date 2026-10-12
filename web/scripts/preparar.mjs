// Prepara o site: copia os CSVs de data/processed para public/data (inteiro e
// um arquivo por indicador) e gera src/estilos/tokens.css a partir de
// design/tokens.json, para que as cores tenham uma única fonte de verdade.
import { csvFormat, csvParse } from "d3-dsv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..", "..");
const proc = path.join(raiz, "data", "processed");
const destino = path.resolve(aqui, "..", "public", "data");

if (!fs.existsSync(path.join(proc, "series.csv"))) {
  console.error("data/processed/series.csv não existe. Rode `make data` na raiz do projeto.");
  process.exit(1);
}

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(path.join(destino, "series"), { recursive: true });
for (const f of ["catalogo_indicadores.csv", "resumos_por_governo.csv", "eventos_contexto.csv", "series.csv", "governos.json", "relatorio_execucao.json"]) {
  fs.copyFileSync(path.join(proc, f), path.join(destino, f));
}
const linhas = csvParse(fs.readFileSync(path.join(proc, "series.csv"), "utf8"));
const porId = new Map();
for (const l of linhas) {
  if (!porId.has(l.indicator_id)) porId.set(l.indicator_id, []);
  porId.get(l.indicator_id).push(l);
}
for (const [id, ls] of porId) {
  fs.writeFileSync(path.join(destino, "series", `${id}.csv`), csvFormat(ls, linhas.columns));
}

// Minigráficos da home: só os governos comparados, por mês (ou ano) do
// mandato. Cada ponto é [posição, valor, vazado], com vazado = 1 quando o
// valor é parcial, fica fora das médias ou é só um limite.
const { comparacao_padrao: comparados } = JSON.parse(fs.readFileSync(path.join(proc, "governos.json"), "utf8"));
const subanual = new Set(["mensal", "trimestre_movel", "trimestral"]);
const periodicidade = new Map(csvParse(fs.readFileSync(path.join(proc, "catalogo_indicadores.csv"), "utf8")).map((c) => [c.indicator_id, c.periodicidade]));
const minis = {};
for (const [id, ls] of porId) {
  const col = subanual.has(periodicidade.get(id)) ? "mes_do_mandato" : "ano_do_mandato";
  const porGov = {};
  for (const g of comparados) {
    porGov[g] = ls
      .filter((l) => l.governo === g && l[col] !== "")
      .map((l) => [Number(l[col]), Number(Number(l.valor).toPrecision(6)), l.parcial === "True" || l.entra_no_resumo === "False" || l.qualificador ? 1 : 0])
      .sort((a, b) => a[0] - b[0]);
  }
  minis[id] = porGov;
}
fs.writeFileSync(path.join(destino, "minis.json"), JSON.stringify(minis));

// Tokens -> CSS
const tokens = JSON.parse(fs.readFileSync(path.join(raiz, "design", "tokens.json"), "utf8"));
const vars = [];
for (const [grupo, itens] of Object.entries(tokens.cor)) {
  if (grupo.startsWith("$")) continue;
  for (const [nome, def] of Object.entries(itens)) {
    if (nome.startsWith("$")) continue;
    vars.push(`  --${grupo}-${nome.replaceAll("_", "-")}: ${def.valor};`);
  }
}
const css = `/* Gerado por web/scripts/preparar.mjs a partir de design/tokens.json. Não editar à mão. */\n:root {\n${vars.join("\n")}\n}\n`;
fs.mkdirSync(path.resolve(aqui, "..", "src", "estilos"), { recursive: true });
fs.writeFileSync(path.resolve(aqui, "..", "src", "estilos", "tokens.css"), css);
console.log(`dados copiados: ${porId.size} indicadores, ${linhas.length} linhas; tokens.css gerado`);
