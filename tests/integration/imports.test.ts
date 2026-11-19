// Integração: importação de extrato + categorização aprendida.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toTransactionData, transactionSchema } from "@/lib/validations";
import { createCategory } from "@/server/categories";
import { deleteCategoryRule, listCategoryRules, suggestCategoryFor } from "@/server/categoryRules";
import type { Ctx } from "@/server/context";
import {
  commitImport,
  createImport,
  discardImport,
  getImport,
  listImports,
  undoImport,
  updateImportRow,
} from "@/server/imports";
import { createTransaction, listTransactions, updateTransaction } from "@/server/transactions";
import { createWallet } from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const bytes = (s: string) => new TextEncoder().encode(s);

const OFX = (extra = "") => `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKTRANLIST>
<STMTTRN><DTPOSTED>20261105<TRNAMT>-52.34<FITID>F1<MEMO>UBER *TRIP 8731
</STMTTRN>
<STMTTRN><DTPOSTED>20261106<TRNAMT>4500.00<FITID>F2<MEMO>SALARIO EMPRESA X
</STMTTRN>
<STMTTRN><DTPOSTED>20261107<TRNAMT>-89.90<FITID>F3<MEMO>MERCADO BOM PRECO
</STMTTRN>${extra}
</BANKTRANLIST></OFX>`;

let ana: Ctx;
let bruno: Ctx;
let banco: string;
let transporte: string;
let mercado: string;
let salario: string;

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  const u = await db.user.create({ data: { name: "ana", email: "ana@imp.local" } });
  const b = await db.user.create({ data: { name: "bruno", email: "bruno@imp.local" } });
  ana = { db, userId: u.id };
  bruno = { db, userId: b.id };
  banco = (await createWallet(ana, { name: "Banco", kind: "CHECKING", openingBalanceCents: 0 })).id;
  transporte = (await createCategory(ana, { name: "Transporte", type: "EXPENSE", color: null })).id;
  mercado = (await createCategory(ana, { name: "Mercado", type: "EXPENSE", color: null })).id;
  salario = (await createCategory(ana, { name: "Salário", type: "INCOME", color: null })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("fluxo de importação", () => {
  it("arquivo -> revisão -> categorizar -> confirmar vira transações pagas, e aprende", async () => {
    const { batchId, summary } = await createImport(ana, { walletId: banco, fileName: "nov.ofx", bytes: bytes(OFX()) });
    // Uber e salário já vêm categorizados pelo dicionário; o mercado (nome qualquer) não.
    expect(summary).toEqual({ total: 3, toImport: 3, duplicates: 0, possibleDuplicates: 0, withoutCategory: 1 });

    // Nada entrou ainda.
    expect(await db.transaction.count({ where: { userId: ana.userId } })).toBe(0);
    await expect(commitImport(ana, batchId)).rejects.toThrow("Escolha a categoria de 1 lançamento");

    const imp = (await getImport(ana, batchId))!;
    expect(imp.rows.map((r) => [r.type, r.amountCents, r.description])).toEqual([
      ["EXPENSE", 5234, "UBER *TRIP 8731"],
      ["INCOME", 450000, "SALARIO EMPRESA X"],
      ["EXPENSE", 8990, "MERCADO BOM PRECO"],
    ]);
    // Tipo errado é barrado.
    await expect(updateImportRow(ana, imp.rows[1].id, { categoryId: mercado })).rejects.toThrow("Receita só pode");
    await updateImportRow(ana, imp.rows[0].id, { categoryId: transporte });
    await updateImportRow(ana, imp.rows[1].id, { categoryId: salario });
    await updateImportRow(ana, imp.rows[2].id, { decision: "SKIP" });

    expect(await commitImport(ana, batchId)).toEqual({ imported: 2, skipped: 1 });
    const txs = await listTransactions(ana, { month: "2026-11" });
    expect(txs.map((t) => [t.description, t.status, t.walletId, t.importBatchId])).toEqual([
      ["SALARIO EMPRESA X", "PAID", banco, batchId],
      ["UBER *TRIP 8731", "PAID", banco, batchId],
    ]);
    await expect(commitImport(ana, batchId)).rejects.toThrow("já foi concluída");

    // Aprendeu: próxima corrida de Uber já vem categorizada.
    expect((await suggestCategoryFor(ana, "UBER *TRIP 1234 SAO PAULO", "EXPENSE"))?.categoryId).toBe(transporte);
    expect((await listCategoryRules(ana)).map((r) => r.pattern).sort()).toEqual(["SALARIO EMPRESA", "UBER TRIP"]);
  });

  it("mesmo arquivo de novo é barrado; arquivo que repete lançamentos marca as duplicatas pra pular", async () => {
    const a = await createImport(ana, { walletId: banco, fileName: "nov.ofx", bytes: bytes(OFX()) });
    const rows = (await getImport(ana, a.batchId))!.rows;
    for (const [i, cat] of [transporte, salario, mercado].entries()) await updateImportRow(ana, rows[i].id, { categoryId: cat });
    await commitImport(ana, a.batchId);

    await expect(createImport(ana, { walletId: banco, fileName: "nov.ofx", bytes: bytes(OFX()) })).rejects.toThrow(
      "já foi importado",
    );

    // Extrato novo que se sobrepõe ao anterior (F1..F3 + F4 novo).
    const extra = "\n<STMTTRN><DTPOSTED>20261110<TRNAMT>-30.00<FITID>F4<MEMO>UBER *TRIP 99\n</STMTTRN>";
    const b = await createImport(ana, { walletId: banco, fileName: "nov2.ofx", bytes: bytes(OFX(extra)) });
    expect(b.summary).toMatchObject({ total: 4, duplicates: 3, toImport: 1, withoutCategory: 0 });
    const novo = (await getImport(ana, b.batchId))!.rows[3];
    expect(novo.categoryId).toBe(transporte); // sugerido pela regra aprendida
    expect(await commitImport(ana, b.batchId)).toEqual({ imported: 1, skipped: 3 });
    expect(await db.transaction.count({ where: { userId: ana.userId } })).toBe(4);
  });

  it("lançamento manual parecido vira 'possível duplicata' (pular por padrão)", async () => {
    await createTransaction(
      ana,
      toTransactionData(
        transactionSchema.parse({ description: "Mercado", amount: "89,90", type: "EXPENSE", date: "2026-11-06", categoryId: mercado }),
      ),
    );
    const { batchId, summary } = await createImport(ana, { walletId: banco, fileName: "x.ofx", bytes: bytes(OFX()) });
    expect(summary.possibleDuplicates).toBe(1);
    const r = (await getImport(ana, batchId))!.rows[2];
    expect(r).toMatchObject({ possibleDuplicate: true, decision: "SKIP" });
  });

  it("CSV: duas compras iguais no mesmo dia são lançamentos diferentes", async () => {
    const csv = "Data;Descrição;Valor\n05/11/2026;CAFE;-5,00\n05/11/2026;CAFE;-5,00\n06/11/2026;CAFE;-5,00";
    const { batchId, summary } = await createImport(ana, { walletId: banco, fileName: "x.csv", bytes: bytes(csv) });
    expect(summary.total).toBe(3);
    const rows = (await getImport(ana, batchId))!.rows;
    expect(new Set(rows.map((r) => r.externalId)).size).toBe(3);
    for (const r of rows) await updateImportRow(ana, r.id, { categoryId: mercado });
    expect((await commitImport(ana, batchId)).imported).toBe(3);
  });

  it("descartar e desfazer liberam o mesmo arquivo pra importar de novo", async () => {
    const a = await createImport(ana, { walletId: banco, fileName: "x.ofx", bytes: bytes(OFX()) });
    await discardImport(ana, a.batchId);
    expect(await listImports(ana)).toHaveLength(0);

    const b = await createImport(ana, { walletId: banco, fileName: "x.ofx", bytes: bytes(OFX()) });
    for (const r of (await getImport(ana, b.batchId))!.rows) await updateImportRow(ana, r.id, { decision: "SKIP" });
    await updateImportRow(ana, (await getImport(ana, b.batchId))!.rows[0].id, { decision: "IMPORT", categoryId: transporte });
    await commitImport(ana, b.batchId);
    expect(await undoImport(ana, b.batchId)).toEqual({ deleted: 1 });
    expect(await db.transaction.count({ where: { userId: ana.userId } })).toBe(0);
    await expect(createImport(ana, { walletId: banco, fileName: "x.ofx", bytes: bytes(OFX()) })).resolves.toBeTruthy();
  });

  it("arquivo sem lançamentos dá erro claro", async () => {
    await expect(createImport(ana, { walletId: banco, fileName: "x.csv", bytes: bytes("a;b\n1;2") })).rejects.toThrow(
      "colunas de data, descrição e valor",
    );
  });
});

describe("marcou um, marca os parecidos", () => {
  it("categoria escolhida vale pras linhas do mesmo estabelecimento/pessoa, sem passar por cima do que foi escolhido na mão", async () => {
    const csv = [
      'data,hora,tipo,"origem / destino",valor,"forma de pagamento"',
      '2026-11-01,10:00,"Pix enviado","Maria Souza","−R$ 10,00","Com saldo"',
      '2026-11-02,10:00,"Pix enviado","Maria Souza","−R$ 20,00","Com saldo"',
      '2026-11-03,10:00,"Pix enviado","Maria Souza","−R$ 30,00","Com saldo"',
      '2026-11-04,10:00,"Pix recebido","Maria Souza","R$ 5,00",',
      '2026-11-05,10:00,"Pix enviado","Joao Lima","−R$ 40,00","Com saldo"',
    ].join("\n");
    const { batchId } = await createImport(ana, { walletId: banco, fileName: "picpay.csv", bytes: bytes(csv) });
    const linhas = () => getImport(ana, batchId).then((b) => b!.rows);
    const [m1, m2, m3, , joao] = await linhas();

    // Escolhe na mão a 3ª da Maria; depois marca a 1ª: vai pra 2ª, não pra 3ª, nem pra receita nem pro João.
    await updateImportRow(ana, m3.id, { categoryId: transporte });
    const r = await updateImportRow(ana, m1.id, { categoryId: mercado });
    expect(r.similarUpdated).toBe(1);
    const depois = await linhas();
    expect(depois.map((x) => x.categoryId)).toEqual([mercado, mercado, transporte, null, null]);

    // Trocar de novo a 1ª arrasta junto quem estava seguindo ela.
    await updateImportRow(ana, m1.id, { categoryId: transporte });
    expect((await linhas()).map((x) => x.categoryId)).toEqual([transporte, transporte, transporte, null, null]);
    expect(m2.id).toBeTruthy();
    expect(joao.categoryId).toBeNull();

    // Já aprendeu: a próxima importação da Maria vem categorizada.
    expect((await suggestCategoryFor(ana, "Pix enviado - Maria Souza", "EXPENSE"))?.categoryId).toBe(transporte);
  });

  it("estorno com a compra no arquivo: as duas ficam de fora, com aviso; sem a compra, entra normal", async () => {
    const csv = [
      'data,hora,tipo,"origem / destino",valor,"forma de pagamento"',
      '2026-11-10,10:00,"Compra realizada",Uber,"−R$ 15,00","Com saldo"',
      '2026-11-10,11:00,"Compra realizada",Uber,"−R$ 15,00","Com saldo"',
      '2026-11-11,09:00,"Compra estornada",Uber,"R$ 15,00",',
      '2026-11-12,09:00,"Compra estornada",Netflix,"R$ 39,90",',
    ].join("\n");
    const { batchId } = await createImport(ana, { walletId: banco, fileName: "estorno.csv", bytes: bytes(csv) });
    const rows = (await getImport(ana, batchId))!.rows;
    expect(rows.map((r) => [r.decision, r.note])).toEqual([
      ["SKIP", "Estornada em 11/11: as duas ficam de fora"], // só UMA das duas compras iguais é anulada
      ["IMPORT", null],
      ["SKIP", "Estorno da compra de 10/11: as duas ficam de fora"],
      ["IMPORT", null],
    ]);
  });

  it("não mexe em importação de outro usuário (IDOR)", async () => {
    const { batchId } = await createImport(ana, { walletId: banco, fileName: "nov.ofx", bytes: bytes(OFX()) });
    const [linha] = (await getImport(ana, batchId))!.rows;
    await expect(updateImportRow(bruno, linha.id, { categoryId: transporte })).rejects.toThrow("Linha não encontrada");
  });
});

describe("aprendizado com lançamentos manuais", () => {
  it("criar ensina, corrigir a categoria muda a regra", async () => {
    const lazer = await createCategory(ana, { name: "Lazer", type: "EXPENSE", color: null });
    const t = await createTransaction(
      ana,
      toTransactionData(
        transactionSchema.parse({ description: "Netflix.com", amount: "39,90", type: "EXPENSE", date: "2026-11-10", categoryId: mercado }),
      ),
    );
    expect((await suggestCategoryFor(ana, "NETFLIX.COM 11/2026", "EXPENSE"))?.categoryId).toBe(mercado);
    await updateTransaction(
      ana,
      t.id,
      toTransactionData(
        transactionSchema.parse({ description: "Netflix.com", amount: "39,90", type: "EXPENSE", date: "2026-11-10", categoryId: lazer.id }),
      ),
    );
    expect((await suggestCategoryFor(ana, "NETFLIX.COM", "EXPENSE"))?.categoryId).toBe(lazer.id);
    const [regra] = await listCategoryRules(ana);
    await deleteCategoryRule(ana, regra.id);
    // Sem a regra aprendida, volta o dicionário (Netflix -> Lazer); nome desconhecido não tem sugestão.
    expect((await suggestCategoryFor(ana, "NETFLIX.COM", "EXPENSE"))?.categoryId).toBe(lazer.id);
    expect(await suggestCategoryFor(ana, "LOJA DO ZE", "EXPENSE")).toBeNull();
  });
});

describe("isolamento (IDOR)", () => {
  it("outro usuário não vê, não mexe e não confirma a importação; nem usa a conta dela", async () => {
    const { batchId } = await createImport(ana, { walletId: banco, fileName: "x.ofx", bytes: bytes(OFX()) });
    const row = (await getImport(ana, batchId))!.rows[0];
    expect(await getImport(bruno, batchId)).toBeNull();
    expect(await listImports(bruno)).toHaveLength(0);
    await expect(updateImportRow(bruno, row.id, { decision: "SKIP" })).rejects.toThrow("Linha não encontrada.");
    await expect(commitImport(bruno, batchId)).rejects.toThrow("Importação não encontrada.");
    await expect(discardImport(bruno, batchId)).rejects.toThrow("Importação não encontrada.");
    await expect(createImport(bruno, { walletId: banco, fileName: "y.ofx", bytes: bytes(OFX()) })).rejects.toThrow(
      "Conta não encontrada.",
    );
    // Categoria do Bruno não pode ir pra linha da Ana (e vice-versa).
    const lazerBruno = await createCategory(bruno, { name: "Lazer", type: "EXPENSE", color: null });
    await expect(updateImportRow(ana, row.id, { categoryId: lazerBruno.id })).rejects.toThrow("Categoria não encontrada.");
    // Regras são por usuário.
    await updateImportRow(ana, row.id, { categoryId: transporte });
    await expect(deleteCategoryRule(bruno, "qualquer")).rejects.toThrow("Regra não encontrada.");
  });
});
