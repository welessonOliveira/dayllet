import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Recria o banco de teste (PostgreSQL *_test) antes da suíte.
    globalSetup: ["tests/global-setup.ts"],
    // Os testes de integração dividem o mesmo banco: um arquivo por vez.
    fileParallelism: false,
  },
});
