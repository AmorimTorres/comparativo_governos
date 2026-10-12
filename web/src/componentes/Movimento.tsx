// Animações discretas: números que contam até o valor e elementos que entram
// quando aparecem na tela. Com "reduzir movimento" ligado no sistema, tudo
// aparece direto no estado final.
import { type RefObject, useEffect, useRef, useState } from "react";

export const semMovimento = () => typeof window === "undefined" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** true a partir da primeira vez que o elemento entra na tela. */
export function useVisivel<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(() => semMovimento() || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visivel || !ref.current) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visivel]);
  return [ref, visivel];
}

const suave = (t: number) => 1 - (1 - t) ** 3;

/** Número que conta do valor anterior (ou de zero) até o atual quando `ativo`. */
export function Contador({ valor, formatar, ativo, duracao = 900 }: { valor: number; formatar: (v: number) => string; ativo: boolean; duracao?: number }) {
  const [exibido, setExibido] = useState(() => (semMovimento() ? valor : 0));
  const anterior = useRef(semMovimento() ? valor : 0);
  useEffect(() => {
    if (!ativo) return;
    if (semMovimento()) {
      anterior.current = valor;
      setExibido(valor);
      return;
    }
    const de = anterior.current;
    const t0 = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / duracao);
      const v = de + (valor - de) * suave(p);
      anterior.current = v;
      setExibido(p >= 1 ? valor : v);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, ativo, duracao]);
  return <>{formatar(exibido)}</>;
}
