// Conta de demonstração: quem visita o portfólio entra em 1 clique e já vê dados.
// Os dados são recriados do zero (reset) de tempos em tempos.
import type { User } from "@prisma/client";
import type { TransactionStatus } from "@/lib/constants";
import { currentMonth, dateInputToUtc, todayInput } from "@/lib/dates";
import type { Db } from "./db";
import { DEFAULT_CATEGORIES } from "./defaults";

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

// 21 transações espalhadas pelos últimos ~85 dias.
const DEMO_TRANSACTIONS: DemoTx[] = [
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 2 },
  { description: "Aluguel", amountCents: 140000, category: "moradia", daysAgo: 1, status: "PENDING" },
  { description: "Conta de luz", amountCents: 18990, category: "moradia", daysAgo: 0, status: "PENDING" },
  { description: "Supermercado", amountCents: 52340, category: "alimentacao", daysAgo: 3 },
  { description: "Lanche com a galera", amountCents: 4590, category: "alimentacao", daysAgo: 1, wallet: "carteira" },
  { description: "Ônibus (recarga)", amountCents: 12000, category: "transporte", daysAgo: 4 },
  { description: "Curso online", amountCents: 9700, category: "educacao", daysAgo: 5, notes: "Curso de React" },
  { description: "Site pra cliente", amountCents: 80000, category: "freelance", daysAgo: 6, status: "PENDING" },
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 32 },
  { description: "Aluguel", amountCents: 140000, category: "moradia", daysAgo: 31 },
  { description: "Supermercado", amountCents: 61220, category: "alimentacao", daysAgo: 35 },
  { description: "Uber", amountCents: 3850, category: "transporte", daysAgo: 38 },
  { description: "Farmácia", amountCents: 7480, category: "saude", daysAgo: 40, wallet: "carteira" },
  { description: "Cinema", amountCents: 6000, category: "lazer", daysAgo: 42, wallet: "carteira" },
  { description: "Freelance de design", amountCents: 35000, category: "freelance", daysAgo: 45 },
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 62 },
  { description: "Aluguel", amountCents: 140000, category: "moradia", daysAgo: 61 },
  { description: "Supermercado", amountCents: 48760, category: "alimentacao", daysAgo: 66 },
  { description: "Gasolina", amountCents: 25000, category: "transporte", daysAgo: 70 },
  { description: "Consulta médica", amountCents: 25000, category: "saude", daysAgo: 75 },
  { description: "Presente de aniversário", amountCents: 12990, category: "outros", daysAgo: 85, wallet: "carteira" },
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
    await tx.budget.createMany({
      data: DEMO_BUDGETS.map((b) => ({
        userId,
        categoryId: cats.get(b.category)!.id,
        month,
        limitCents: b.limitCents,
      })),
    });

    await tx.user.update({ where: { id: userId }, data: { demoResetAt: now } });
  });
}
