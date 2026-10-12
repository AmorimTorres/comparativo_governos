import { useEffect, useState } from "react";

// Estado compartilhável na URL (hash): #/ , #/i/<id>?... , #/metodologia
export interface Rota {
  pagina: "home" | "indicador" | "metodologia";
  id?: string;
  params: URLSearchParams;
}

export function lerRota(hash = window.location.hash): Rota {
  const h = hash.replace(/^#/, "") || "/";
  const [caminho, query = ""] = h.split("?");
  const params = new URLSearchParams(query);
  const partes = caminho.split("/").filter(Boolean);
  if (partes[0] === "i" && partes[1]) return { pagina: "indicador", id: decodeURIComponent(partes[1]), params };
  if (partes[0] === "metodologia") return { pagina: "metodologia", params };
  return { pagina: "home", params };
}

export function hrefRota(pagina: Rota["pagina"], id?: string, params?: Record<string, string | undefined>): string {
  const base = pagina === "indicador" ? `#/i/${encodeURIComponent(id!)}` : pagina === "metodologia" ? "#/metodologia" : "#/";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** Atualiza parâmetros da rota atual sem criar entrada no histórico. */
export function atualizarParams(mudancas: Record<string, string | undefined>) {
  const r = lerRota();
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === undefined || v === "") r.params.delete(k);
    else r.params.set(k, v);
  }
  const base = window.location.hash.replace(/^#/, "").split("?")[0] || "/";
  const s = r.params.toString();
  history.replaceState(null, "", `#${base}${s ? "?" + s : ""}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => lerRota());
  useEffect(() => {
    const f = () => setRota(lerRota());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return rota;
}
