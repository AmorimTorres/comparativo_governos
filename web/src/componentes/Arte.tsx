// Elementos gráficos da identidade, recriados em SVG (sem reaproveitar as artes):
// losango amarelo com contorno paralelo e seis estrelas vermelhas em arco.

import type { ReactNode } from "react";

const ESTRELA = "0,-9 2.1,-2.9 8.6,-2.8 3.4,1.1 5.3,7.3 0,3.6 -5.3,7.3 -3.4,1.1 -8.6,-2.8 -2.1,-2.9";

export function Estrelas({ largura, y0, escala = 1 }: { largura: number; y0: number; escala?: number }) {
  // Três de cada lado do topo, espelhadas, mais altas perto do centro.
  const pos = [
    [0.222, 0],
    [0.14, 0.045],
    [0.06, 0.1],
  ];
  return (
    <g fill="#EA0104" stroke="#FEDD02" strokeWidth={0.9 / escala} aria-hidden="true">
      {pos.flatMap(([x, dy], i) => [
        <polygon key={`e${i}`} points={ESTRELA} transform={`translate(${x * largura},${y0 + dy * largura}) scale(${escala})`} />,
        <polygon key={`d${i}`} points={ESTRELA} transform={`translate(${(1 - x) * largura},${y0 + dy * largura}) scale(${escala})`} />,
      ])}
    </g>
  );
}

/** Losango da arte num quadro largura × altura: topo, base e laterais em proporção. */
export function Losango({
  largura,
  altura,
  topo,
  base,
  margemLateral = -0.02,
  contorno = 0.045,
}: {
  largura: number;
  altura: number;
  topo: number;
  base: number;
  margemLateral?: number;
  contorno?: number;
}) {
  const cx = largura / 2;
  const t = topo * altura;
  const b = base * altura;
  const cy = (t + b) / 2;
  const e = margemLateral * largura;
  const d = largura - e;
  const o = contorno * altura;
  return (
    <g aria-hidden="true">
      <polygon points={`${cx},${t - o} ${d + o * 1.3},${cy} ${cx},${b + o} ${e - o * 1.3},${cy}`} fill="none" stroke="#FEDD02" strokeWidth={Math.max(1, largura / 400)} />
      <polygon points={`${cx},${t} ${d},${cy} ${cx},${b} ${e},${cy}`} fill="#FEDD02" />
    </g>
  );
}

/** Marcador do governo: o mesmo traço do gráfico (sólido ou tracejado, na cor
 * do governo) terminando no losango da identidade, que também marca os pontos
 * das linhas. Liga legenda, cartões, tabelas e gráficos sem depender só da cor. */
export function MarcadorGoverno({ cor, traco, tamanho = 10 }: { cor: string; traco: string; tamanho?: number }) {
  const h = tamanho;
  const w = h * 2.6;
  const d = h * 0.45; // meia-diagonal do losango
  const xl = w - d - 0.5;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="marcador" aria-hidden="true">
      <line x1={1} x2={xl - d} y1={h / 2} y2={h / 2} stroke={cor} strokeWidth={Math.max(2, h * 0.24)} strokeLinecap="round" strokeDasharray={traco === "tracejado" ? `${h * 0.38} ${h * 0.3}` : traco === "pontilhado" ? `1 ${h * 0.3}` : undefined} />
      <polygon points={`${xl},${h / 2 - d} ${xl + d},${h / 2} ${xl},${h / 2 + d} ${xl - d},${h / 2}`} fill={cor} />
    </svg>
  );
}

/** Estrela vermelha com contorno amarelo, como nas artes. */
export function Estrela({ tamanho = 14 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="-10 -10 20 19" className="estrela" aria-hidden="true">
      <polygon points={ESTRELA} fill="#EA0104" stroke="#FEDD02" strokeWidth={1.2} />
    </svg>
  );
}

/** Losango alongado (hexágono com pontas laterais) com contorno paralelo:
 * versão da forma da arte que deixa espaço para números grandes. */
export function LosangoAlongado({ ponta = 7 }: { ponta?: number }) {
  const p = ponta;
  const i = 2.2; // recuo do preenchimento em relação ao contorno
  return (
    <svg className="fundo-losango" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`${p},0.8 ${100 - p},0.8 99.6,50 ${100 - p},99.2 ${p},99.2 0.4,50`} fill="none" stroke="#FEDD02" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <polygon points={`${p + i * 0.6},${i * 2.6} ${100 - p - i * 0.6},${i * 2.6} ${100 - i},50 ${100 - p - i * 0.6},${100 - i * 2.6} ${p + i * 0.6},${100 - i * 2.6} ${i},50`} fill="#FEDD02" />
    </svg>
  );
}

// Seta única do painel: haste e ponta em traço arredondado, no desenho da seta
// da Barlow ("↑ maior é melhor"). Substitui os caracteres ↑ ↓ → ←, que mudam de
// desenho conforme a fonte de cada lugar (Anton, Barlow Condensed, Barlow).
const GIRO = { cima: 0, direita: 90, baixo: 180, esquerda: 270 } as const;
export type DirecaoSeta = keyof typeof GIRO;

export function Seta({ direcao = "cima" }: { direcao?: DirecaoSeta }) {
  return (
    <svg className="seta" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.5V4M5.5 10.5 12 4l6.5 6.5" transform={GIRO[direcao] ? `rotate(${GIRO[direcao]} 12 12)` : undefined} />
    </svg>
  );
}

/** Duas setas opostas, no mesmo desenho, para "Sortear outro". */
export function SetaTroca() {
  return (
    <svg className="seta seta-troca" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5h15M14.5 3 19 7.5 14.5 12M20 16.5H5M9.5 12 5 16.5 9.5 21" />
    </svg>
  );
}

const CARACTERE_SETA: Record<string, DirecaoSeta> = { "↑": "cima", "→": "direita", "↓": "baixo", "←": "esquerda" };

/** Troca os caracteres de seta de um texto pela <Seta>. Uma seta entre palavras
 * ("Início → fim") ganha "até" só para leitores de tela; nas pontas é decorativa. */
export function comSetas(texto: string): ReactNode {
  if (!/[↑→↓←]/.test(texto)) return texto;
  const partes = texto.split(/([↑→↓←])/);
  return partes.map((parte, i) => {
    const dir = CARACTERE_SETA[parte];
    if (!dir) return parte;
    const meio = partes[i - 1]?.trim() && partes[i + 1]?.trim();
    return (
      <span key={i} className="seta-texto">
        <Seta direcao={dir} />
        {meio && <span className="sr-only">até</span>}
      </span>
    );
  });
}
