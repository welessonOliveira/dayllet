// Jornada principal: visitante entra na demo, vê o painel, cria uma despesa e troca o tema.
import { expect, test } from "@playwright/test";

test("visitante entra na demo, cria uma despesa e ela aparece na lista", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/); // sem sessão, vai pro login

  await page.getByRole("button", { name: /Entrar como visitante/ }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible({ timeout: 30_000 });
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

test("páginas públicas abrem sem login", async ({ page }) => {
  for (const [rota, titulo] of [
    ["/privacidade", "Política de Privacidade"],
    ["/termos", "Termos de Uso"],
  ]) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
  }
});
