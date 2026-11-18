// Liga/desliga o PostgreSQL local (instalado sem serviço do Windows).
// Uso: npm run db:start | npm run db:stop | npm run db:status
// A pasta do Postgres vem de PG_HOME (padrão: D:\Claude\Ferramentas\postgresql-17).
import { spawnSync } from "node:child_process";
import path from "node:path";

const PG_HOME = process.env.PG_HOME ?? "D:\\Claude\\Ferramentas\\postgresql-17";
const bin = (nome) => path.join(PG_HOME, "bin", nome);
const data = path.join(PG_HOME, "data");
const log = path.join(PG_HOME, "postgres.log");

const acao = process.argv[2];
const args = {
  start: ["-D", data, "-l", log, "-w", "start"],
  stop: ["-D", data, "-w", "stop"],
  status: ["-D", data, "status"],
}[acao];

if (!args) {
  console.error("Use: node scripts/db-local.mjs start|stop|status");
  process.exit(1);
}

// stdio "ignore": se herdar a saída, o terminal fica preso esperando o servidor.
const r = spawnSync(bin("pg_ctl.exe"), args, { stdio: "ignore" });
const pronto = spawnSync(bin("pg_isready.exe"), ["-h", "localhost"], { encoding: "utf8" });
console.log(pronto.stdout.trim() || `pg_ctl ${acao} terminou com código ${r.status}`);
