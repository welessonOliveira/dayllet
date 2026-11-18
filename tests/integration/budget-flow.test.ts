// Teste de integração: usa um Postgres de verdade (banco financas_test),
// recriado pelo tests/global-setup.ts antes da suíte.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { budgetSchema, toBudgetData, toTransactionData, transactionSchema } from "@/lib/validations";
import { createBudget, deleteBudget, listBudgetsWithProgress } from "@/server/budgets";
import { createCategory, deleteCategory, listCategories, updateCategory } from "@/server/categories";
import type { Ctx } from "@/server/context";
import { getDashboardData } from "@/server/dashboard";
import { setupNewUser } from "@/server/defaults";
import { ensureDemoUser, maybeResetDemo, resetDemoData } from "@/server/demo";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  setTransactionStatus,
  updateTransaction,
} from "@/server/transactions";
import {
  createWallet,
  deleteWallet,
  listWallets,
  listWalletsWithBalance,
  setDefaultWallet,
} from "@/server/wallets";
import { TEST_DATABASE_URL } from "../test-db";

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

const MES = "2026-11";

// Monta os dados como se viessem do formulário, passando pela validação real.
function txForm(over: Record<string, string>) {
  return toTransactionData(
    transactionSchema.parse({
      description: "Mercado",
      amount: "100,00",
      type: "EXPENSE",
      date: "2026-11-10",
      categoryId: "",
      ...over,
    }),
  );
}

/** Cria um usuário "vazio" (sem categorias) e devolve o contexto dele. */
async function novoUsuario(nome: string): Promise<Ctx> {
  const u = await db.user.create({ data: { name: nome, email: `${nome}@teste.local` } });
  return { db, userId: u.id };
}

const cat = (ctx: Ctx, name: string, type: "INCOME" | "EXPENSE" = "EXPENSE") =>
  createCategory(ctx, { name, type, color: null });

let ana: Ctx;
let bruno: Ctx;

beforeEach(async () => {
  // Apagar o usuário apaga tudo dele (cascade), menos transações (Restrict na conta/categoria),
  // então elas saem primeiro.
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  ana = await novoUsuario("ana");
  bruno = await novoUsuario("bruno");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("criar transação reflete no orçamento", () => {
  it("o gasto do orçamento sobe com despesas pagas e pendentes do mês", async () => {
    const alimentacao = await cat(ana, "Alimentação");
    await createBudget(
      ana,
      toBudgetData(budgetSchema.parse({ categoryId: alimentacao.id, month: MES, limit: "500,00" })),
    );

    let [orc] = await listBudgetsWithProgress(ana, MES);
    expect(orc.progress.spentCents).toBe(0);

    await createTransaction(ana, txForm({ categoryId: alimentacao.id, amount: "150,00" }));
    await createTransaction(
      ana,
      txForm({ categoryId: alimentacao.id, amount: "400,00", status: "PENDING", date: "2026-11-30" }),
    );
    // Fora do mês: não conta.
    await createTransaction(ana, txForm({ categoryId: alimentacao.id, amount: "999,00", date: "2026-10-31" }));

    [orc] = await listBudgetsWithProgress(ana, MES);
    expect(orc.progress).toMatchObject({
      spentCents: 55000,
      remainingCents: -5000,
      percentUsed: 110,
      isOver: true,
    });

    // O dashboard usa o mesmo progresso e o saldo só conta o que foi pago.
    const dash = await getDashboardData(ana, MES);
    expect(dash.budgets[0].progress.spentCents).toBe(55000);
    expect(dash.summary.expenseCents).toBe(15000);
    expect(dash.summary.pendingExpenseCents).toBe(40000);
    expect(dash.summary.count).toBe(2);
  });
});

describe("regras no servidor", () => {
  it("bloqueia transação com tipo diferente da categoria", async () => {
    const salario = await cat(ana, "Salário", "INCOME");
    await expect(createTransaction(ana, txForm({ categoryId: salario.id, type: "EXPENSE" }))).rejects.toThrow(
      DomainError,
    );
    expect(await db.transaction.count()).toBe(0);
  });

  it("bloqueia orçamento duplicado e orçamento de receita", async () => {
    const moradia = await cat(ana, "Moradia");
    const salario = await cat(ana, "Salário", "INCOME");
    const data = { categoryId: moradia.id, month: MES, limitCents: 100000 };
    await createBudget(ana, data);
    await expect(createBudget(ana, data)).rejects.toThrow("Já existe um orçamento");
    await expect(createBudget(ana, { ...data, categoryId: salario.id })).rejects.toThrow(DomainError);
  });

  it("não exclui categoria com transações; sem transações apaga os orçamentos junto", async () => {
    const lazer = await cat(ana, "Lazer");
    const saude = await cat(ana, "Saúde");
    await createTransaction(ana, txForm({ categoryId: lazer.id }));
    await createBudget(ana, { categoryId: saude.id, month: MES, limitCents: 1000 });

    await expect(deleteCategory(ana, lazer.id)).rejects.toThrow("não pode ser excluída");
    expect(await deleteCategory(ana, saude.id)).toEqual({ deletedBudgets: 1 });
    expect(await db.budget.count()).toBe(0);
  });

  it("nome de categoria é único por usuário (outro usuário pode repetir)", async () => {
    await cat(ana, "Outros");
    await expect(cat(ana, "Outros")).rejects.toThrow("Você já tem uma categoria com esse nome.");
    await expect(cat(bruno, "Outros")).resolves.toMatchObject({ name: "Outros" });
  });

  it("listTransactions filtra por mês, tipo, categoria, conta e texto", async () => {
    const mercado = await cat(ana, "Mercado");
    const salario = await cat(ana, "Salário", "INCOME");
    await createWallet(ana, { name: "Banco", kind: "CHECKING", openingBalanceCents: 0 }); // 1ª = padrão
    const carteira = await createWallet(ana, { name: "Carteira", kind: "WALLET", openingBalanceCents: 0 });
    await createTransaction(ana, txForm({ categoryId: mercado.id, description: "Feira do mês" }));
    await createTransaction(ana, txForm({ categoryId: mercado.id, description: "Padaria", date: "2026-10-05" }));
    await createTransaction(
      ana,
      txForm({ categoryId: salario.id, type: "INCOME", description: "Salário", walletId: carteira.id }),
    );

    expect(await listTransactions(ana, { month: MES })).toHaveLength(2);
    expect(await listTransactions(ana, { month: MES, type: "INCOME" })).toHaveLength(1);
    expect(await listTransactions(ana, { month: MES, categoryId: mercado.id })).toHaveLength(1);
    expect(await listTransactions(ana, { month: MES, walletId: carteira.id })).toHaveLength(1);
    const busca = await listTransactions(ana, { month: MES, q: "FEIRA" });
    expect(busca.map((t) => t.description)).toEqual(["Feira do mês"]);
    expect(busca[0].category.name).toBe("Mercado");
  });
});

describe("isolamento entre usuários (IDOR)", () => {
  it("um usuário não lê, não edita e não apaga dados de outro", async () => {
    const lazerAna = await cat(ana, "Lazer");
    const tx = await createTransaction(ana, txForm({ categoryId: lazerAna.id }));
    const orc = await createBudget(ana, { categoryId: lazerAna.id, month: MES, limitCents: 1000 });
    const lazerBruno = await cat(bruno, "Lazer");

    // Ler
    expect(await getTransaction(bruno, tx.id)).toBeNull();
    expect(await listTransactions(bruno, { month: MES })).toHaveLength(0);
    expect(await listCategories(bruno)).toHaveLength(1); // só a dele
    expect(await listBudgetsWithProgress(bruno, MES)).toHaveLength(0);

    // Editar / apagar com o id do outro
    const dados = txForm({ categoryId: lazerBruno.id });
    await expect(updateTransaction(bruno, tx.id, dados)).rejects.toThrow("Transação não encontrada.");
    await expect(setTransactionStatus(bruno, tx.id, "PENDING")).rejects.toThrow(DomainError);
    await expect(deleteTransaction(bruno, tx.id)).rejects.toThrow(DomainError);
    await expect(updateCategory(bruno, lazerAna.id, { name: "X", type: "EXPENSE", color: null })).rejects.toThrow(
      "Categoria não encontrada.",
    );
    await expect(deleteCategory(bruno, lazerAna.id)).rejects.toThrow(DomainError);
    await expect(deleteBudget(bruno, orc.id)).rejects.toThrow(DomainError);

    // Usar a categoria ou a conta do outro numa transação própria
    await expect(createTransaction(bruno, txForm({ categoryId: lazerAna.id }))).rejects.toThrow(
      "Categoria não encontrada.",
    );
    const [contaAna] = await listWallets(ana);
    await expect(
      createTransaction(bruno, txForm({ categoryId: lazerBruno.id, walletId: contaAna.id })),
    ).rejects.toThrow("Conta não encontrada.");

    // Nada da Ana mudou
    const intacta = await getTransaction(ana, tx.id);
    expect(intacta).toMatchObject({ status: "PAID", categoryId: lazerAna.id });
  });
});

describe("contas (Wallet)", () => {
  it("transação sem conta vai pra conta padrão, e o saldo considera saldo inicial e status", async () => {
    const salario = await cat(ana, "Salário", "INCOME");
    const mercado = await cat(ana, "Mercado");
    const banco = await createWallet(ana, { name: "Banco", kind: "CHECKING", openingBalanceCents: 100000 });
    expect(banco.isDefault).toBe(true); // primeira conta vira padrão

    await createTransaction(ana, txForm({ categoryId: salario.id, type: "INCOME", amount: "500,00" }));
    await createTransaction(ana, txForm({ categoryId: mercado.id, amount: "200,00" }));
    await createTransaction(ana, txForm({ categoryId: mercado.id, amount: "50,00", status: "PENDING" }));

    const [w] = await listWalletsWithBalance(ana);
    expect(w.id).toBe(banco.id);
    expect(w.transactionCount).toBe(3);
    expect(w.balance).toEqual({ currentCents: 130000, projectedCents: 125000 });
    expect((await getDashboardData(ana, MES)).totalBalanceCents).toBe(130000);
  });

  it("não apaga conta com lançamentos nem a única conta; troca a padrão", async () => {
    const mercado = await cat(ana, "Mercado");
    const a = await createWallet(ana, { name: "A", kind: "CHECKING", openingBalanceCents: 0 });
    const b = await createWallet(ana, { name: "B", kind: "WALLET", openingBalanceCents: 0 });
    await createTransaction(ana, txForm({ categoryId: mercado.id, walletId: a.id }));

    await expect(deleteWallet(ana, a.id)).rejects.toThrow("não pode ser excluída");
    await setDefaultWallet(ana, b.id);
    expect((await listWallets(ana))[0].id).toBe(b.id); // padrão vem primeiro
    await expect(createWallet(ana, { name: "A", kind: "SAVINGS", openingBalanceCents: 0 })).rejects.toThrow(
      "Você já tem uma conta com esse nome.",
    );

    const c = await novoUsuario("carla");
    const unica = await createWallet(c, { name: "Única", kind: "CHECKING", openingBalanceCents: 0 });
    await expect(deleteWallet(c, unica.id)).rejects.toThrow("pelo menos uma conta");
  });
});

describe("usuário novo e conta demo", () => {
  it("setupNewUser cria categorias padrão e conta padrão, sem duplicar", async () => {
    await setupNewUser(db, ana.userId);
    await setupNewUser(db, ana.userId);
    expect(await listCategories(ana)).toHaveLength(9);
    const wallets = await listWallets(ana);
    expect(wallets).toHaveLength(1);
    expect(wallets[0].isDefault).toBe(true);
  });

  it("a demo é recriada sem duplicar, só depois de 1 hora, e nunca mexe em outro usuário", async () => {
    await cat(ana, "Da Ana");
    const demo = await ensureDemoUser(db);
    const t0 = new Date("2026-11-18T12:00:00Z");
    await resetDemoData(db, demo.id, t0);
    await resetDemoData(db, demo.id, t0);
    const demoCtx = { db, userId: demo.id };
    // 18 avulsas + 8 geradas pelas regras (aluguel 3x, internet 3x, celular 2 parcelas)
    expect(await db.transaction.count({ where: { userId: demo.id } })).toBe(26);
    expect(await db.recurringRule.count({ where: { userId: demo.id } })).toBe(3);
    expect(await listWallets(demoCtx)).toHaveLength(2);

    const atual = (await db.user.findUnique({ where: { id: demo.id } }))!;
    expect(await maybeResetDemo(db, atual, new Date("2026-11-18T12:30:00Z"))).toBe(false);
    expect(await maybeResetDemo(db, atual, new Date("2026-11-18T13:01:00Z"))).toBe(true);

    expect(await listCategories(ana)).toHaveLength(1); // a Ana continua com a dela
    await expect(resetDemoData(db, ana.userId)).rejects.toThrow("só pode ser usado na conta demo");
  });
});
