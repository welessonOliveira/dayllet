// Conta de demonstração: quem visita o portfólio entra em 1 clique e já vê dados.
// Os dados são recriados do zero (reset) de tempos em tempos.
import type { User } from "@prisma/client";
import type { TransactionStatus } from "@/lib/constants";
import { currentMonth, dateInputToUtc, shiftMonth, todayInput } from "@/lib/dates";
import type { Db } from "./db";
import { DEFAULT_CATEGORIES } from "./defaults";
import { learnCategory } from "./categoryRules";
import { syncRecurring } from "./recurring";

export const DEMO_EMAIL = "demo@financas.local";
/** De quanto em quanto tempo os dados da demo são recriados no login. */
export const DEMO_RESET_MS = 60 * 60 * 1000; // 1 hora

/** Busca (ou cria) o usuário de demonstração. */
export async function ensureDemoUser(db: Db): Promise<User> {
  return db.user.upsert({
    where: { email: DEMO_EMAIL },
    create: { email: DEMO_EMAIL, name: "Visitante (demo)", isDemo: true },
    update: {},
  });
}

/** Recria os dados da demo se a última vez foi há mais de 1 hora (ou nunca). */
export async function maybeResetDemo(db: Db, user: User, now = new Date()): Promise<boolean> {
  if (user.demoResetAt && now.getTime() - user.demoResetAt.getTime() < DEMO_RESET_MS) return false;
  await resetDemoData(db, user.id, now);
  return true;
}

type DemoTx = {
  description: string;
  amountCents: number;
  category: string; // key de DEFAULT_CATEGORIES
  daysAgo: number;
  wallet?: "carteira";
  status?: TransactionStatus;
  notes?: string;
};

// 18 transações avulsas espalhadas pelos últimos ~85 dias.
// O aluguel, a internet e o celular parcelado vêm das regras (DEMO_RULES).
const DEMO_TRANSACTIONS: DemoTx[] = [
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 2 },
  { description: "Conta de luz", amountCents: 18990, category: "moradia", daysAgo: 0, status: "PENDING" },
  { description: "Supermercado", amountCents: 52340, category: "alimentacao", daysAgo: 3 },
  { description: "Lanche com a galera", amountCents: 4590, category: "alimentacao", daysAgo: 1, wallet: "carteira" },
  { description: "Ônibus (recarga)", amountCents: 12000, category: "transporte", daysAgo: 4 },
  { description: "Curso online", amountCents: 9700, category: "educacao", daysAgo: 5, notes: "Curso de React" },
  { description: "Site pra cliente", amountCents: 80000, category: "freelance", daysAgo: 6, status: "PENDING" },
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 32 },
  { description: "Supermercado", amountCents: 61220, category: "alimentacao", daysAgo: 35 },
  { description: "Uber", amountCents: 3850, category: "transporte", daysAgo: 38 },
  { description: "Farmácia", amountCents: 7480, category: "saude", daysAgo: 40, wallet: "carteira" },
  { description: "Cinema", amountCents: 6000, category: "lazer", daysAgo: 42, wallet: "carteira" },
  { description: "Freelance de design", amountCents: 35000, category: "freelance", daysAgo: 45 },
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 62 },
  { description: "Supermercado", amountCents: 48760, category: "alimentacao", daysAgo: 66 },
  { description: "Gasolina", amountCents: 25000, category: "transporte", daysAgo: 70 },
  { description: "Consulta médica", amountCents: 25000, category: "saude", daysAgo: 75 },
  { description: "Presente de aniversário", amountCents: 12990, category: "outros", daysAgo: 85, wallet: "carteira" },
];

/** Contas fixas e parcelado da demo. `monthsAgo` = em que mês começou; `day` = dia do mês. */
const DEMO_RULES = [
  { description: "Aluguel", amountCents: 140000, category: "moradia", monthsAgo: 2, day: 10 },
  { description: "Internet", amountCents: 9990, category: "moradia", monthsAgo: 2, day: 15 },
  // Parcelado: amountCents é o TOTAL (12x de R$ 200,00).
  { description: "Celular novo", amountCents: 240000, category: "outros", monthsAgo: 1, day: 5, installments: 12 },
];

const DEMO_BUDGETS = [
  { category: "moradia", limitCents: 160000 },
  { category: "alimentacao", limitCents: 50000 },
  { category: "transporte", limitCents: 30000 },
];

/** Dia de N dias atrás (calendário de São Paulo), às 12:00 UTC. */
function daysAgoUtc(days: number, now: Date): Date {
  const hoje = dateInputToUtc(todayInput(now));
  return new Date(hoje.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Apaga TODOS os dados financeiros do usuário e recria os de exemplo.
 * Só pode ser chamado pra usuário de demonstração (trava abaixo).
 */
export async function resetDemoData(db: Db, userId: string, now = new Date()): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.isDemo) throw new Error("resetDemoData só pode ser usado na conta demo.");

  await db.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.importBatch.deleteMany({ where: { userId } });
    await tx.categoryRule.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    await tx.transfer.deleteMany({ where: { userId } });
    await tx.recurringRule.deleteMany({ where: { userId } });
    await tx.budget.deleteMany({ where: { userId } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.wallet.deleteMany({ where: { userId } });

    const principal = await tx.wallet.create({
      data: { userId, name: "Conta corrente", kind: "CHECKING", openingBalanceCents: 120000, isDefault: true },
    });
    const carteira = await tx.wallet.create({
      data: { userId, name: "Carteira", kind: "WALLET", openingBalanceCents: 15000 },
    });

    const cats = new Map<string, { id: string; type: "INCOME" | "EXPENSE" }>();
    for (const c of DEFAULT_CATEGORIES) {
      const criada = await tx.category.create({
        data: { userId, name: c.name, type: c.type, color: c.color },
      });
      cats.set(c.key, { id: criada.id, type: criada.type });
    }

    await tx.transaction.createMany({
      data: DEMO_TRANSACTIONS.map((t) => {
        const cat = cats.get(t.category)!;
        return {
          userId,
          walletId: t.wallet === "carteira" ? carteira.id : principal.id,
          categoryId: cat.id,
          type: cat.type,
          description: t.description,
          amountCents: t.amountCents,
          status: t.status ?? "PAID",
          date: daysAgoUtc(t.daysAgo, now),
          notes: t.notes ?? null,
        };
      }),
    });

    const month = currentMonth(now);
    await tx.recurringRule.createMany({
      data: DEMO_RULES.map((r) => {
        const cat = cats.get(r.category)!;
        return {
          userId,
          walletId: principal.id,
          categoryId: cat.id,
          type: cat.type,
          description: r.description,
          amountCents: r.amountCents,
          frequency: "MONTHLY" as const,
          startDate: dateInputToUtc(`${shiftMonth(month, -r.monthsAgo)}-${String(r.day).padStart(2, "0")}`),
          installments: r.installments ?? null,
        };
      }),
    });

    await tx.budget.createMany({
      data: DEMO_BUDGETS.map((b) => ({
        userId,
        categoryId: cats.get(b.category)!.id,
        month,
        limitCents: b.limitCents,
      })),
    });

    // Saque: tirou R$ 100 da conta corrente pra carteira (não é despesa).
    await tx.transfer.create({
      data: {
        userId,
        fromWalletId: principal.id,
        toWalletId: carteira.id,
        amountCents: 10000,
        date: daysAgoUtc(20, now),
        note: "Saque",
      },
    });

    // Metas: uma com prazo (em 5 meses) e uma reserva sem prazo.
    const notebook = await tx.goal.create({
      data: {
        userId,
        name: "Notebook novo",
        targetCents: 400000,
        targetDate: dateInputToUtc(`${shiftMonth(month, 4)}-28`),
        color: "#7c3aed",
      },
    });
    const reserva = await tx.goal.create({
      data: { userId, name: "Reserva de emergência", targetCents: 1000000, color: "#16a34a" },
    });
    await tx.goalContribution.createMany({
      data: [
        { goalId: notebook.id, amountCents: 50000, date: daysAgoUtc(40, now), note: "Começando" },
        { goalId: notebook.id, amountCents: 60000, date: daysAgoUtc(10, now) },
        { goalId: reserva.id, amountCents: 200000, date: daysAgoUtc(60, now) },
        { goalId: reserva.id, amountCents: 50000, date: daysAgoUtc(30, now) },
      ],
    });

    await tx.user.update({ where: { id: userId }, data: { demoResetAt: now } });
  });

  // Gera as ocorrências das regras (o que é antes de hoje entra como pago).
  const ctx = { db, userId };
  await syncRecurring(ctx, undefined, now);

  // Ensina a categorização automática com os lançamentos de exemplo + descrições
  // do extrato de exemplo (public/exemplos/extrato-exemplo.ofx).
  const cats = new Map(
    (await db.category.findMany({ where: { userId } })).map((c) => [c.name, c.id]),
  );
  const exemplos: [string, string][] = [
    ...DEMO_TRANSACTIONS.map((t): [string, string] => [t.description, DEFAULT_CATEGORIES.find((c) => c.key === t.category)!.name]),
    ["UBER *TRIP", "Transporte"],
    ["IFOOD *PEDIDO", "Alimentação"],
    ["DROGARIA SAO PAULO", "Saúde"],
  ];
  for (const [descricao, categoria] of exemplos) {
    const id = cats.get(categoria);
    if (id) await learnCategory(ctx, descricao, id);
  }
}
