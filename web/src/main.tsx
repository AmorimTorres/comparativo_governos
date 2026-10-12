import "@fontsource/anton/400.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "./estilos/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
