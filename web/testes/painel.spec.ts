import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function semViolacoes(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id}: ${v.nodes.length} nós`)).toEqual([]);
}

test("home mostra cartões com período e sem rótulo parcial visual", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/dois governos/i);
  const cartao = page.locator("article.cartao").first();
  await expect(cartao).toBeVisible();
  await expect(cartao.locator(".pill-parcial")).toHaveCount(0);
  await expect(cartao).toContainText("Fonte");
  await semViolacoes(page);
});

test("filtro por tema e busca ficam na URL", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Meio ambiente" }).click();
  await expect(page).toHaveURL(/t=meio_ambiente/);
  await expect(page.locator("article.cartao")).not.toHaveCount(0);
  await page.getByLabel("Buscar indicador").fill("gasolina");
  await expect(page).toHaveURL(/q=gasolina/);
  await page.reload();
  await expect(page.getByLabel("Buscar indicador")).toHaveValue("gasolina");
});

test("seletor de métrica muda os cartões", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("group", { name: "Métrica exibida" }).getByRole("button", { name: "Pico" }).click();
  await expect(page).toHaveURL(/m=pico/);
  await expect(page.locator("article.cartao").first()).toContainText(/Pico/i);
});

test("melhor resultado só onde a direção é consensual, e pode ser desligado", async ({ page }) => {
  await page.goto("./#/?h=desemprego");
  const desemprego = page.locator("article.cartao", { has: page.locator("#t-desemprego") });
  await expect(desemprego.locator(".lado.melhor")).toHaveCount(1);
  await expect(desemprego.locator(".lado.melhor")).toContainText("Lula 3");
  await expect(desemprego.locator("#d-desemprego")).toContainText("Melhor resultado: Lula 3");
  // Indicador sem direção consensual: sem estrela.
  const gasolina = page.locator("article.cartao", { has: page.locator("#t-gasolina_real") });
  await expect(gasolina.locator(".lado.melhor")).toHaveCount(0);
  await expect(gasolina).toContainText("Sem direção consensual");
  // Desligar o destaque tira todos os globos e vai para a URL.
  await page.getByLabel("Destacar o melhor resultado").uncheck();
  await expect(page).toHaveURL(/d=0/);
  await expect(page.locator(".lado.melhor")).toHaveCount(0);
});

test("página do indicador tem gráfico, fonte e CSV", async ({ page }) => {
  await page.goto("./#/i/desemprego");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/desemprego/i);
  await expect(page.locator("#grafico svg")).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar CSV" })).toHaveAttribute("href", /series\/desemprego\.csv/);
  await expect(page.getByRole("heading", { name: "Ressalvas" })).toBeVisible();
  await expect(page.locator(".comparacao td.melhor")).not.toHaveCount(0);
  await page.getByRole("group", { name: "Métrica dos números e da imagem" }).getByRole("button", { name: "Pico" }).click();
  await expect(page).toHaveURL(/m=pico/);
  await expect(page.locator(".palco-ind .palco-metrica")).toContainText(/Pico/i);
  for (const v of ["Por data", "Barras anuais", "Por mês do mandato"]) {
    await page.getByRole("button", { name: v }).click();
    await expect(page.locator("#grafico svg")).toBeVisible();
  }
  await semViolacoes(page);
});

test("feminicídios: sem estrela no registro, análise e indicadores comparáveis", async ({ page }) => {
  await page.goto("./#/i/feminicidios");
  await expect(page.locator(".palco-ind .lado.melhor")).toHaveCount(0);
  await expect(page.locator(".palco-ind")).toContainText("Registro em consolidação");
  const analise = page.locator(".analise");
  await expect(analise).toContainText("Entenda este número");
  await expect(analise.locator("#grafico-analise svg")).toBeVisible();
  await expect(analise.locator("article.cartao")).toHaveCount(1);
  await expect(analise.locator("#t-mulheres_assassinadas")).toBeVisible();
  await semViolacoes(page);
});

test("compartilhar gera PNG 1080×1350", async ({ page, isMobile }) => {
  test.skip(isMobile, "no celular o botão abre o compartilhamento nativo");
  await page.goto("./#/i/ipca_mensal");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Compartilhar como imagem" }).click();
  const d = await download;
  const caminho = await d.path();
  const fs = await import("node:fs");
  const buf = fs.readFileSync(caminho!);
  // Cabeçalho PNG: largura e altura nos bytes 16–23.
  expect(buf.readUInt32BE(16)).toBe(1080);
  expect(buf.readUInt32BE(20)).toBe(1350);
});

test("metodologia explica atribuição e causalidade", async ({ page }) => {
  await page.goto("./#/metodologia");
  await expect(page.getByRole("heading", { name: /correlação não é causalidade/i })).toBeVisible();
  await expect(page.getByText(/PRODES \(agosto a julho\)/)).toBeVisible();
  await semViolacoes(page);
});
