import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, AriaComponent, SVGRenderer]);

export type OpcaoGrafico = echarts.EChartsCoreOption;

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Gráfico ECharts. O texto alternativo (descricao) resume o que o gráfico
 * mostra; a tabela de dados da página oferece todos os valores. */
export function Grafico({ opcao, descricao, id }: { opcao: OpcaoGrafico; descricao: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const g = echarts.init(ref.current, undefined, { renderer: "svg" });
    grafico.current = g;
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      g.dispose();
      grafico.current = null;
    };
  }, []);

  useEffect(() => {
    grafico.current?.setOption({ animation: !reduzirMovimento(), ...opcao }, true);
  }, [opcao]);

  return <div ref={ref} id={id} className="grafico" role="img" aria-label={descricao} />;
}
