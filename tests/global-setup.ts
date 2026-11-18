import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { TEST_DATABASE_URL } from "./test-db";

// Recria o banco de teste do zero: apaga SÓ o prisma/test.db e aplica as migrations.
// (Não usa `migrate reset` pra nunca correr o risco de mexer no dev.db.)
export default function setup() {
  const arquivo = path.resolve(import.meta.dirname, "../prisma/test.db");
  rmSync(arquivo, { force: true });
  rmSync(`${arquivo}-journal`, { force: true });
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
