import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

// Endereço público do site, usado nas meta tags Open Graph (as redes exigem
// URL absoluta). Ordem: SITE_URL definido à mão; domínio de produção da
// Vercel (variável injetada no build); vazio no desenvolvimento local.
const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/$/, "");

function enderecoPublico(): Plugin {
  return { name: "endereco-publico", transformIndexHtml: { order: "pre", handler: (html) => html.replaceAll("%SITE_URL%", siteUrl) } };
}

// base relativa: o site funciona na raiz de qualquer domínio ou numa subpasta.
export default defineConfig({
  base: "./",
  plugins: [react(), enderecoPublico()],
  build: { outDir: "dist", sourcemap: false },
});
