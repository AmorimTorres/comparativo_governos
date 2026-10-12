import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./testes",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4173/", locale: "pt-BR" },
  webServer: { command: "npx vite preview --port 4173 --strictPort", port: 4173, reuseExistingServer: true },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
});
