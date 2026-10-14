// "Compartilhar como imagem": monta um SVG 1080×1350 no formato das artes
// (kicker, losango com os números, linha de apoio, barra de fonte) e o
// converte em PNG. Todos os campos de contexto são obrigatórios pelo tipo
// CartaoExportavel, para que a imagem não circule sem janela, rótulo de
// parcial, fonte e data.
import antonUrl from "@fontsource/anton/files/anton-latin-400-normal.woff2?url";
import barlowUrl from "@fontsource/barlow/files/barlow-latin-500-normal.woff2?url";
import condensedUrl from "@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url";

export interface LadoExportavel {
  governo: string; // nome do governo
  cor: string;
  traco: string; // sólido, tracejado ou pontilhado (o marcador do governo)
  valorTexto: string; // número principal já formatado (ex.: "12,5%")
  janela: string; // período coberto (ex.: "jan/2019–ago/2022")
  parcial: boolean; // mandato incompleto
  detalhe?: string; // ex.: período do pico
  melhor?: boolean; // melhor resultado (só quando a direção é consensual)
}

export interface CartaoExportavel {
  titulo: string; // nome do indicador
  tema: string;
  metrica: string; // ex.: "Média mensal • meses 1–44 de cada mandato"
  lados: [LadoExportavel, LadoExportavel];
  fonte: string; // órgão + série
  atualizacao: string; // data de coleta
  ultimoPeriodo: string;
  url: string;
  nota?: string; // linha sob os números (ex.: "MENOR É MELHOR", "EMPATE NA PRECISÃO EXIBIDA")
}

async function base64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

let fontesCss: Promise<string> | null = null;
function fontes(): Promise<string> {
  if (!fontesCss) {
    fontesCss = Promise.all([base64(antonUrl), base64(condensedUrl), base64(barlowUrl)]).then(
      ([a, c, b]) => `
@font-face{font-family:'AntonX';src:url(data:font/woff2;base64,${a}) format('woff2');}
@font-face{font-family:'CondX';font-weight:600;src:url(data:font/woff2;base64,${c}) format('woff2');}
@font-face{font-family:'BarlowX';font-weight:500;src:url(data:font/woff2;base64,${b}) format('woff2');}`,
    );
  }
  return fontesCss;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Quebra texto em linhas de até n caracteres. */
function quebrar(texto: string, n: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    if ((atual + " " + p).trim().length > n && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = (atual + " " + p).trim();
  }
  if (atual) linhas.push(atual);
  return linhas;
}

const ESTRELA = "0,-9 2.1,-2.9 8.6,-2.8 3.4,1.1 5.3,7.3 0,3.6 -5.3,7.3 -3.4,1.1 -8.6,-2.8 -2.1,-2.9";

function marcadorSvg(traco: string, cor: string, xFim: number, y: number, h: number): string {
  // Mesmo marcador do painel: traço do gráfico terminando no losango.
  const d = h * 0.45;
  const xl = xFim - d;
  const tr = traco === "tracejado" ? ` stroke-dasharray="${h * 0.38} ${h * 0.3}"` : "";
  // Cápsula branca atrás, como no painel.
  const x0 = xl - d - h * 1.6 - h * 0.6;
  const capsula = `<rect x="${x0}" y="${y - h * 0.85}" width="${xFim + h * 0.6 - x0}" height="${h * 1.7}" rx="${h * 0.85}" fill="#fff" stroke="#D8D4C6" stroke-width="1.5"/>`;
  return `${capsula}<line x1="${xl - d - h * 1.6}" x2="${xl - d}" y1="${y}" y2="${y}" stroke="${cor}" stroke-width="${h * 0.24}" stroke-linecap="round"${tr}/><polygon points="${xl},${y - d} ${xl + d},${y} ${xl},${y + d} ${xl - d},${y}" fill="${cor}"/>`;
}

// Geometria (1080×1350): losango com topo em y=150, base em y=1150 e largura
// total; meia-largura útil numa altura y = 520 × (1 − |y − 650| / 500).
const W = 1080;
const H = 1350;
const CY = 650;
const meiaLargura = (y: number) => 520 * (1 - Math.abs(y - CY) / 500);

export async function svgCartao(c: CartaoExportavel): Promise<string> {
  const css = await fontes();
  // Título: 1 linha (80 px, até 17 caracteres), 2 linhas (64 px, até 18; ou
  // 54 px, até 22) ou 3 linhas (46 px, até 26).
  let tamTitulo = 80;
  let titulo = quebrar(c.titulo.toUpperCase(), 17);
  if (titulo.length > 1) {
    tamTitulo = 64;
    titulo = quebrar(c.titulo.toUpperCase(), 18);
  }
  if (titulo.length > 2) {
    tamTitulo = 54;
    titulo = quebrar(c.titulo.toUpperCase(), 22);
  }
  if (titulo.length > 2) {
    // Nomes longos (ex.: "Mulheres assassinadas a cada 100 mil (dados da saúde)"): 3 linhas de 46 px.
    tamTitulo = 46;
    titulo = quebrar(c.titulo.toUpperCase(), 26);
  }
  if (titulo.length > 3) titulo = [titulo[0], titulo[1], titulo.slice(2).join(" ").slice(0, 25) + "…"];
  const yTitulo = titulo.length === 1 ? [565] : titulo.length === 2 ? [512, 512 + tamTitulo * 1.05] : [478, 527, 576];
  const estrelas = [
    [0.222, 0.125],
    [0.14, 0.155],
    [0.06, 0.195],
  ]
    .flatMap(([x, y]) => [
      `<polygon points="${ESTRELA}" transform="translate(${x * W},${y * H}) scale(3)"/>`,
      `<polygon points="${ESTRELA}" transform="translate(${(1 - x) * W},${y * H}) scale(3)"/>`,
    ])
    .join("");
  // Linhas de cada lado: nome do governo (632), selo PARCIAL (644–678),
  // globo do melhor resultado (680–836, com a faixa "MELHOR" em 688–720),
  // número (base 812, até 96 px), janela (864) e detalhe (896). Colunas em
  // x = 370 e 710.
  const ladoSvg = (l: LadoExportavel, cx: number) => {
    // Largura aproximada da Anton: 0,52 em por caractere; limite de 300 px.
    const tam = Math.min(96, Math.floor(300 / (0.52 * Math.max(l.valorTexto.length, 3))));
    const rotulo = l.governo.toUpperCase();
    const largRotulo = rotulo.length * 19;
    const corNumero = l.melhor ? "#FFFFFF" : "#012672";
    // Janelas longas (ex.: triênios da FAO) quebram em duas linhas para não invadir a outra coluna.
    const janela = l.janela.length > 20 ? quebrar(l.janela, 20).slice(0, 2) : [l.janela];
    const globo = l.melhor
      ? `<rect x="${cx - 160}" y="680" width="320" height="156" rx="28" fill="#012672"/>
        <rect x="${cx - 92}" y="688" width="184" height="32" rx="16" fill="#FFFFFF"/>
        <polygon points="${ESTRELA}" transform="translate(${cx - 62},704) scale(1.25)" fill="#EA0104" stroke="#FEDD02" stroke-width="0.8"/>
        <text x="${cx + 14}" y="713" text-anchor="middle" font-family="CondX" font-weight="600" font-size="24" letter-spacing="3" fill="#0B6B2C">MELHOR</text>`
      : "";
    return `
      <g>
        ${marcadorSvg(l.traco, l.cor, cx - largRotulo / 2 - 22, 620, 22)}
        <text x="${cx}" y="632" text-anchor="middle" font-family="CondX" font-weight="600" font-size="36" letter-spacing="1.5" fill="#012672">${esc(rotulo)}</text>
        ${globo}
        <text x="${cx}" y="812" text-anchor="middle" font-family="AntonX" font-size="${tam}" fill="${corNumero}">${esc(l.valorTexto)}</text>
        ${janela.map((t, i) => `<text x="${cx}" y="${864 + i * 28}" text-anchor="middle" font-family="BarlowX" font-weight="500" font-size="${janela.length > 1 ? 24 : 27}" fill="#012672">${esc(t)}</text>`).join("")}
        ${l.detalhe ? `<text x="${cx}" y="${896 + (janela.length - 1) * 28}" text-anchor="middle" font-family="BarlowX" font-weight="500" font-size="25" fill="#012672">${esc(l.detalhe)}</text>` : ""}
      </g>`;
  };
  const apoio = quebrar(c.metrica.toUpperCase(), 46).slice(0, 2);
  const apoioLinhas = quebrar(c.metrica.toUpperCase(), 46).length > 1 ? 2 : 1;
  const fonte = quebrar(c.fonte, 72).slice(0, apoioLinhas > 1 ? 1 : 2);
  const o = 36; // afastamento do contorno
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><style>${css}</style></defs>
  <rect width="${W}" height="${H}" fill="#13893B"/>
  <polygon points="540,${150 - o} ${1060 + o * 1.04},${CY} 540,${1150 + o} ${20 - o * 1.04},${CY}" fill="none" stroke="#FEDD02" stroke-width="3"/>
  <polygon points="540,150 1060,${CY} 540,1150 20,${CY}" fill="#FEDD02"/>
  <g fill="#EA0104" stroke="#FEDD02" stroke-width="0.8">${estrelas}</g>
  <text x="48" y="70" font-family="CondX" font-weight="600" font-size="30" letter-spacing="5" fill="#FFFFFF">${esc(`DADOS OFICIAIS • ${c.tema.toUpperCase()}`)}</text>
  ${titulo.map((t, i) => `<text x="540" y="${yTitulo[i]}" text-anchor="middle" font-family="AntonX" font-size="${tamTitulo}" fill="#012672">${esc(t)}</text>`).join("")}
  <line x1="540" y1="605" x2="540" y2="870" stroke="#012672" stroke-width="2" opacity="0.3"/>
  ${c.nota ? `<text x="540" y="982" text-anchor="middle" font-family="CondX" font-weight="600" font-size="28" letter-spacing="2.5" fill="#012672">${esc(c.nota.toUpperCase())}</text>` : ""}
  ${ladoSvg(c.lados[0], 370)}
  ${ladoSvg(c.lados[1], 710)}
  ${apoio.map((t, i) => `<text x="540" y="${1215 + i * 38}" text-anchor="middle" font-family="CondX" font-weight="600" font-size="34" letter-spacing="2" fill="#FFFFFF">${esc(t)}</text>`).join("")}
  <rect y="${apoio.length > 1 ? 1262 : 1240}" width="${W}" height="${apoio.length > 1 ? 88 : 110}" fill="#012672"/>
  <text x="40" y="${apoio.length > 1 ? 1292 : 1276}" font-family="CondX" font-weight="600" font-size="26" letter-spacing="3" fill="#FEDD02">FONTE</text>
  ${fonte.map((t, i) => `<text x="138" y="${(apoio.length > 1 ? 1292 : 1276) + i * 28}" font-family="BarlowX" font-weight="500" font-size="24" fill="#FFFFFF">${esc(t)}</text>`).join("")}
  <text x="40" y="1338" font-family="BarlowX" font-weight="500" font-size="22" fill="#FFFFFF">${esc(`Coleta ${c.atualizacao} · último dado: ${c.ultimoPeriodo} · ${c.url}`)}</text>
</svg>`;
}

// Usado nos testes para conferir que o texto cabe no losango.
export const _geometria = { W, H, CY, meiaLargura };

export async function pngCartao(c: CartaoExportavel): Promise<Blob> {
  const svg = await svgCartao(c);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error("Falha ao desenhar o cartão"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error("Falha ao gerar PNG"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compartilharCartao(c: CartaoExportavel, nomeArquivo: string): Promise<"compartilhado" | "baixado"> {
  const blob = await pngCartao(c);
  const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [arquivo] }) && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ files: [arquivo], title: c.titulo, text: `${c.titulo} — ${c.fonte}` });
      return "compartilhado";
    } catch {
      /* usuário cancelou: cai no download */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "baixado";
}
