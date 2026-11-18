import { existsSync } from "node:fs";
import path from "node:path";

// Carrega o .env (Node 22 já sabe ler, sem biblioteca) pra pegar a TEST_DATABASE_URL.
const envFile = path.resolve(import.meta.dirname, "../.env");
if (!process.env.TEST_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Defina TEST_DATABASE_URL no .env (veja o .env.example).");

// Trava de segurança: os testes APAGAM esse banco. Só aceita banco com nome terminando em _test.
const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith("_test")) {
  throw new Error(`TEST_DATABASE_URL precisa apontar pra um banco *_test (veio "${dbName}").`);
}

export const TEST_DATABASE_URL = url;
