// Testes de ponta a ponta (E2E): um navegador de verdade usa o app como uma pessoa.
// Local: usa o Edge do Windows (sem baixar navegador) e sobe o `npm run dev`.
// CI: usa o Chromium do Playwright e o build de produção (`npm run start`).
import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(CI ? {} : { channel: "msedge" }) } },
    { name: "celular", use: { ...devices["Pixel 7"], ...(CI ? {} : { channel: "msedge" }) } },
  ],
  webServer: {
    command: CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
