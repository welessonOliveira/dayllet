// Jornada principal: visitante entra na demo, vê o painel, cria uma despesa e troca o tema.
import { expect, test } from "@playwright/test";

test("visitante entra na demo, cria uma despesa e ela aparece na lista", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/); // sem sessão, vai pro login

  await page.getByRole("button", { name: /Entrar como visitante/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite)/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saldo total nas contas")).toBeVisible();

  await page.goto("/transacoes");
  await page.getByRole("button", { name: "Nova transação" }).first().click();
  const descricao = `Pizza E2E ${Date.now()}`;
  await page.getByLabel(/Descrição/).fill(descricao);
  await page.getByLabel(/Valor/).fill("42,50");
  const categoria = page.locator("#tx-category");
  if (!(await categoria.inputValue())) await categoria.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Criar transação" }).click();

  // No celular a lista vira cartões e a tabela fica escondida: procura só o que está visível.
  await expect(page.getByText(descricao).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("R$ 42,50").filter({ visible: true }).first()).toBeVisible();
});

test("busca rápida (Ctrl+K) leva pra página e as abas da seção aparecem", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Entrar como visitante/ }).click();
  await expect(page.getByText("Saldo total nas contas")).toBeVisible({ timeout: 30_000 });

  // O atalho só funciona depois que a página "acorda" (hidratação): tenta de novo até abrir.
  const busca = page.getByRole("combobox", { name: "Buscar" });
  await expect(async () => {
    if (!(await busca.isVisible())) await page.keyboard.press("Control+k");
    await expect(busca).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await busca.fill("metas");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/metas$/);
  const abas = page.getByRole("navigation", { name: "Abas de Planejamento" });
  await expect(abas.getByRole("link", { name: "Metas" })).toHaveAttribute("aria-current", "page");
  await expect(abas.getByRole("link", { name: "Orçamentos" })).toBeVisible();
});

test("páginas públicas abrem sem login", async ({ page }) => {
  for (const [rota, titulo] of [
    ["/privacidade", "Política de Privacidade"],
    ["/termos", "Termos de Uso"],
  ]) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
  }
});

test("anexa um comprovante na transação e abre pelo clipe", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Entrar como visitante/ }).click();
  await expect(page.getByText("Saldo total nas contas")).toBeVisible({ timeout: 30_000 });

  await page.goto("/transacoes");
  await page.getByRole("button", { name: "Nova transação" }).first().click();
  const descricao = `Recibo E2E ${Date.now()}`;
  await page.getByLabel(/Descrição/).fill(descricao);
  await page.getByLabel(/Valor/).fill("15,00");
  const categoria = page.locator("#tx-category");
  if (!(await categoria.inputValue())) await categoria.selectOption({ index: 1 });
  await page.locator("#tx-attachment").setInputFiles({
    name: "recibo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
  });
  await expect(page.getByText("será enviado ao salvar")).toBeVisible();
  await page.getByRole("button", { name: "Criar transação" }).click();

  const clipe = page.getByRole("link", { name: "Abrir comprovante: recibo.pdf" }).filter({ visible: true }).first();
  await expect(clipe).toBeVisible();
  const href = await clipe.getAttribute("href");
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toBe("application/pdf");
});
