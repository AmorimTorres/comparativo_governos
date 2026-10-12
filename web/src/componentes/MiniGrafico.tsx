// Minigráfico dos cartões: as duas trajetórias sobrepostas por mês (ou ano) do
// mandato, com o traço e o marcador de cada governo. É decorativo para leitores
// de tela (o cartão já descreve os números); a série completa está na página do
// indicador.
import type { PontoMini } from "../dados";
import type { Governo, Indicador } from "../tipos";

const W = 320;
const M = { e: 6, d: 10, t: 8, b: 16 };

function marcador(m: string, x: number, y: number, cor: string, vazado: boolean, s = 7) {
  const props = { fill: vazado ? "#fff" : cor, stroke: cor, strokeWidth: 1.6 };
  if (m === "quadrado") return <rect x={x - s / 2} y={y - s / 2} width={s} height={s} {...props} />;
  if (m === "triangulo") return <polygon points={`${x},${y - s / 2} ${x + s / 2},${y + s / 2} ${x - s / 2},${y + s / 2}`} {...props} />;
  if (m === "losango") return <polygon points={`${x},${y - s / 2} ${x + s / 2},${y} ${x},${y + s / 2} ${x - s / 2},${y}`} {...props} />;
  return <circle cx={x} cy={y} r={s / 2} {...props} />;
}

export function MiniGrafico({ ind, series, governos, visivel, alto }: { ind: Indicador; series: Record<string, PontoMini[]> | undefined; governos: Governo[]; visivel: boolean; alto?: boolean }) {
  const H = alto ? 150 : 84;
  if (!series) return <div className="mini mini-vazio" aria-hidden="true" />;
  const mensal = ["mensal", "trimestre_movel", "trimestral"].includes(ind.periodicidade);
  const xMax = mensal ? 48 : 4;
  const todos = governos.flatMap((g) => series[g.id] ?? []);
  if (!todos.length) return <div className="mini mini-vazio" aria-hidden="true" />;
  const vs = todos.map((p) => p[1]);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (ind.acumulado === "soma" && min >= 0) min = 0;
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const x = (p: number) => M.e + ((p - 1) / (xMax - 1)) * (W - M.e - M.d);
  const y = (v: number) => M.t + (1 - (v - min) / (max - min)) * (H - M.t - M.b);
  const zero = min < 0 && max > 0 ? y(0) : null;
  const poucos = todos.length <= 2 * 8;
  return (
    <div className={`mini${visivel ? " visivel" : ""}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <line x1={M.e} x2={W - M.d} y1={H - M.b} y2={H - M.b} stroke="#D8D4C6" />
        {zero !== null && <line x1={M.e} x2={W - M.d} y1={zero} y2={zero} stroke="#8A877C" strokeDasharray="2 3" />}
        {governos.map((g) => {
          const pts = series[g.id] ?? [];
          if (!pts.length) return null;
          const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
          const ult = pts[pts.length - 1];
          return (
            <g key={g.id}>
              <path d={d} fill="none" stroke={g.estilo.cor} strokeWidth={2.2} strokeDasharray={g.estilo.traco === "tracejado" ? "6 3" : g.estilo.traco === "pontilhado" ? "2 3" : undefined} strokeLinejoin="round" />
              {poucos && pts.slice(0, -1).map((p) => <g key={p[0]}>{marcador(g.estilo.marcador, x(p[0]), y(p[1]), g.estilo.cor, p[2] === 1, 6)}</g>)}
              {marcador(g.estilo.marcador, x(ult[0]), y(ult[1]), g.estilo.cor, ult[2] === 1, 8)}
            </g>
          );
        })}
        <text x={M.e} y={H - 3} fontSize="10" fill="#5B5B5B" fontFamily="Barlow, sans-serif">
          {mensal ? "mês 1" : "ano 1"}
        </text>
        <text x={W - M.d} y={H - 3} fontSize="10" fill="#5B5B5B" textAnchor="end" fontFamily="Barlow, sans-serif">
          {mensal ? "mês 48 do mandato" : "ano 4 do mandato"}
        </text>
      </svg>
    </div>
  );
}
