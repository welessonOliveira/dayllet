// Importação que reconhece transferências (Pix pra si mesmo, fatura, cofrinho) e o modo cartão.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { commitImport, createImport, getImport, undoImport, updateImportRow } from "@/server/imports";
import { createWallet, listWalletsWithBalance } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const bytes = (s: string) => new TextEncoder().encode(s);
const HOJE = new Date("2026-11-18T15:00:00Z");
let ana: Ctx;
let bruno: Ctx;
let nubank: string;
let picpay: string;
let cartao: string;
let cofrinho: string;
let contaDoBruno: string;

const PICPAY = [
  'data,hora,tipo,"origem / destino",valor,"forma de pagamento"',
  '2026-11-10,10:00,"Pix recebido","Ana Maria de Souza Lima","R$ 100,00",',
  '2026-11-11,10:00,"Pagamento realizado","Fatura PicPay Card","−R$ 50,00","Com saldo"',
  '2026-11-12,10:00,"Guardado no cofrinho","Cofrinho","−R$ 20,00","Com saldo"',
  '2026-11-13,10:00,"Compra realizada",Uber,"−R$ 12,00","Com cartão"',
].join("\n");

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.transfer.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { name: "Ana Lima", email: "ana@it.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { name: "Bruno Melo", email: "bruno@it.local" } })).id };
  nubank = (await createWallet(ana, { name: "Nubank", kind: "CHECKING", openingBalanceCents: 0 })).id;
  picpay = (await createWallet(ana, { name: "PicPay", kind: "CHECKING", openingBalanceCents: 0 })).id;
  cartao = (await createWallet(ana, { name: "PicPay Card", kind: "CREDIT_CARD", openingBalanceCents: 0, closingDay: 3, dueDay: 10 })).id;
  cofrinho = (await createWallet(ana, { name: "Cofrinho", kind: "SAVINGS", openingBalanceCents: 0 })).id;
  contaDoBruno = (await createWallet(bruno, { name: "Conta", kind: "CHECKING", openingBalanceCents: 0 })).id;
  await createCategory(ana, { name: "Transporte", type: "EXPENSE", color: null });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("transferências na importação", () => {
  it("Pix pra si mesmo, fatura e cofrinho viram transferência com a conta certa; compra no cartão fica de fora", async () => {
    const { batchId, summary, errors } = await createImport(ana, { walletId: picpay, fileName: "picpay.csv", bytes: bytes(PICPAY) });
    expect(errors).toEqual([expect.stringContaining("1 compra(s) no cartão")]);
    expect(summary.withoutCategory).toBe(0);
    const rows = (await getImport(ana, batchId))!.rows;
    expect(rows.map((r) => [r.looksLikeTransfer, r.transferWallet?.name, r.categoryId])).toEqual([
      [true, "Nubank", null],
      [true, "PicPay Card", null],
      [true, "Cofrinho", null],
    ]);

    expect(await commitImport(ana, batchId)).toEqual({ imported: 3, skipped: 0 });
    const saldo = Object.fromEntries((await listWalletsWithBalance(ana, HOJE)).map((w) => [w.name, w.balance.currentCents]));
    expect(saldo).toEqual({ Nubank: -10000, PicPay: 3000, "PicPay Card": 5000, Cofrinho: 2000 });
    expect(await db.transaction.count({ where: { userId: ana.userId } })).toBe(0); // nada virou receita/despesa

    // O mesmo Pix no extrato do Nubank não entra de novo.
    const nu = "Data,Valor,Identificador,Descrição\n10/11/2026,-100.00,abc-1,Transferência enviada pelo Pix - ANA MARIA DE SOUZA LIMA";
    const b2 = await createImport(ana, { walletId: nubank, fileName: "nubank.csv", bytes: bytes(nu) });
    const [linha] = (await getImport(ana, b2.batchId))!.rows;
    expect([linha.decision, linha.transferWalletId, linha.note]).toEqual(["SKIP", picpay, expect.stringContaining("já está no app")]);

    // Desfazer apaga as transferências da importação.
    expect(await undoImport(ana, batchId)).toEqual({ deleted: 3 });
    expect(await db.transfer.count({ where: { userId: ana.userId } })).toBe(0);
  });

  it("no cartão, o arquivo do PicPay traz só as compras 'Com cartão'", async () => {
    const { batchId, errors } = await createImport(ana, { walletId: cartao, fileName: "picpay.csv", bytes: bytes(PICPAY) });
    const rows = (await getImport(ana, batchId))!.rows;
    expect(rows.map((r) => [r.description, r.type, r.amountCents])).toEqual([["Uber", "EXPENSE", 1200]]);
    expect(errors[0]).toMatch(/3 movimentação\(ões\) da conta/);
  });

  it("escolher a outra conta na mão; não pode ser a mesma do extrato nem conta de outro usuário", async () => {
    const csv = 'data,hora,tipo,"origem / destino",valor,"forma de pagamento"\n2026-11-10,10:00,"Pix enviado","Joao","−R$ 10,00","Com saldo"';
    const { batchId } = await createImport(ana, { walletId: picpay, fileName: "x.csv", bytes: bytes(csv) });
    const [linha] = (await getImport(ana, batchId))!.rows;
    expect(linha.looksLikeTransfer).toBe(false);
    await expect(updateImportRow(ana, linha.id, { transferWalletId: picpay })).rejects.toThrow("diferente da do extrato");
    await expect(updateImportRow(ana, linha.id, { transferWalletId: contaDoBruno })).rejects.toThrow("Conta não encontrada");
    await updateImportRow(ana, linha.id, { transferWalletId: cofrinho });
    expect(await commitImport(ana, batchId)).toEqual({ imported: 1, skipped: 0 });
    const [t] = await db.transfer.findMany({ where: { userId: ana.userId } });
    expect([t.fromWalletId, t.toWalletId, t.amountCents]).toEqual([picpay, cofrinho, 1000]);
  });
});
