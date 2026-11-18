// Relatórios: CSV e inflação (com API do Banco Central FALSA, sem internet).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toTransactionData, transactionSchema } from "@/lib/validations";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { type Fetcher, getIpcaRates, refreshIpca, sgsUrl } from "@/server/indexRates";
import { exportTransactionsCsv, getInflationReport } from "@/server/reports";
import { createTransaction } from "@/server/transactions";
import { createWallet } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const AGORA = new Date("2026-11-18T15:00:00Z");
let ana: Ctx;
let bruno: Ctx;
let mercado: string;
let chamadas: number;

const apiFalsa: Fetcher = async () => {
  chamadas++;
  return [
    { data: "01/08/2026", valor: "0.50" },
    { data: "01/09/2026", valor: "1.00" },
    { data: "01/10/2026", valor: "1.00" },
  ];
};
const apiForaDoAr: Fetcher = async () => {
  chamadas++;
  throw new Error("timeout");
};

async function lanca(ctx: Ctx, description: string, amount: string, date: string) {
  return createTransaction(
    ctx,
    toTransactionData(transactionSchema.parse({ description, amount, type: "EXPENSE", date, categoryId: mercado })),
  );
}

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  await db.indexRate.deleteMany();
  chamadas = 0;
  ana = { db, userId: (await db.user.create({ data: { email: "ana@rep.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { email: "bruno@rep.local" } })).id };
  await createWallet(ana, { name: "Banco", kind: "CHECKING", openingBalanceCents: 0 });
  mercado = (await createCategory(ana, { name: "Mercado", type: "EXPENSE", color: null })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("exportar CSV", () => {
  it("respeita os filtros, sai em ordem de data e protege contra fórmula", async () => {
    await lanca(ana, "=CMD|' /C calc'!A0", "10,00", "2026-11-05");
    await lanca(ana, "Feira", "1.234,56", "2026-11-02");
    await lanca(ana, "Outubro", "1,00", "2026-10-02");
    const { fileName, content } = await exportTransactionsCsv(ana, { month: "2026-11" });
    expect(fileName).toBe("transacoes-2026-11.csv");
    const linhas = content.replace("﻿", "").trim().split("\r\n");
    expect(linhas[0]).toBe("Data;Descrição;Categoria;Conta;Tipo;Situação;Valor (R$);Observações");
    expect(linhas[1]).toBe("02/11/2026;Feira;Mercado;Banco;Despesa;Pago;-1234,56;");
    expect(linhas[2].split(";")[1]).toBe("'=CMD|' /C calc'!A0");
    expect(linhas).toHaveLength(3);
    // Outro usuário exporta vazio.
    expect((await exportTransactionsCsv(bruno, { month: "2026-11" })).content.trim().split("\r\n")).toHaveLength(1);
  });
});

describe("IPCA e gastos corrigidos", () => {
  it("URL da API busca por período (o modo 'últimos N' só aceita até 20)", () => {
    expect(sgsUrl(AGORA)).toBe(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/11/2023&dataFinal=01/11/2026",
    );
  });

  it("busca na API uma vez, guarda no cache e não chama de novo", async () => {
    expect(await refreshIpca(db, AGORA, apiFalsa)).toBe(true);
    expect(await refreshIpca(db, AGORA, apiFalsa)).toBe(false); // outubro (= mês retrasado+1) já está lá
    expect(chamadas).toBe(1);
    expect(await getIpcaRates(db, AGORA, apiFalsa)).toEqual([
      { month: "2026-08", rateBps: 50 },
      { month: "2026-09", rateBps: 100 },
      { month: "2026-10", rateBps: 100 },
    ]);
  });

  it("API fora do ar: não quebra, usa o que tem (ou nada)", async () => {
    expect(await refreshIpca(db, AGORA, apiForaDoAr)).toBe(false);
    const r = await getInflationReport(ana, 2, AGORA, apiForaDoAr);
    expect(r.lastIpcaMonth).toBeNull();
    expect(r.rows.every((x) => x.adjustedCents === x.expenseCents)).toBe(true);
  });

  it("corrige o gasto de cada mês até o último IPCA publicado", async () => {
    await lanca(ana, "Mercado agosto", "1.000,00", "2026-08-10");
    await lanca(ana, "Mercado novembro", "500,00", "2026-11-10");
    const r = await getInflationReport(ana, 4, AGORA, apiFalsa);
    expect(r.lastIpcaMonth).toBe("2026-10");
    expect(r.rows.map((x) => [x.month, x.expenseCents, x.adjustedCents, x.inflationBps])).toEqual([
      ["2026-08", 100000, 102010, 201], // × 1,01 (set) × 1,01 (out)
      ["2026-09", 0, 0, 100],
      ["2026-10", 0, 0, 0],
      ["2026-11", 50000, 50000, 0], // depois do último IPCA: sem correção
    ]);
    // Isolamento: o Bruno não tem gastos.
    expect((await getInflationReport(bruno, 4, AGORA, apiFalsa)).rows.every((x) => x.expenseCents === 0)).toBe(true);
  });
});
