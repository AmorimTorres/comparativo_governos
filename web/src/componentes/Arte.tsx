// Elementos gráficos da identidade, recriados em SVG (sem reaproveitar as artes):
// losango amarelo com contorno paralelo e seis estrelas vermelhas em arco.

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

export function MarcadorGoverno({ cor, marcador, tamanho = 10 }: { cor: string; marcador: string; tamanho?: number }) {
  const s = tamanho;
  return (
    <svg width={s} height={s} viewBox="0 0 10 10" className="marcador" aria-hidden="true">
      {marcador === "circulo" && <circle cx="5" cy="5" r="5" fill={cor} />}
      {marcador === "quadrado" && <rect width="10" height="10" fill={cor} />}
      {marcador === "triangulo" && <polygon points="5,0 10,10 0,10" fill={cor} />}
      {marcador === "losango" && <polygon points="5,0 10,5 5,10 0,5" fill={cor} />}
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
