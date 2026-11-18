import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Recria o banco de teste (prisma/test.db) antes da suíte.
    globalSetup: ["tests/global-setup.ts"],
    // Os testes de integração dividem o mesmo arquivo SQLite.
    fileParallelism: false,
  },
});
