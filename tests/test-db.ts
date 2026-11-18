import path from "node:path";

// Banco SQLite só de teste. Caminho absoluto pra não depender da pasta atual.
export const TEST_DATABASE_URL =
  "file:" + path.resolve(import.meta.dirname, "../prisma/test.db").split(path.sep).join("/");
