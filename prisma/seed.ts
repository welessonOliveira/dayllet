// Seed idempotente: usa IDs fixos + upsert, então pode rodar quantas vezes quiser
// sem duplicar nada. As datas são relativas ao dia em que o seed roda
// (Decisão 6), então mudam se ele for rodado em outro dia/mês.
import { PrismaClient } from "@prisma/client";
import type { CategoryType, TransactionStatus } from "../src/lib/constants";
import { currentMonth, dateInputToUtc, todayInput } from "../src/lib/dates";

const prisma = new PrismaClient();

type SeedCategory = { id: string; name: string; type: CategoryType; color: string };

const categories: SeedCategory[] = [
  { id: "seed-cat-salario", name: "Salário", type: "INCOME", color: "#16a34a" },
  { id: "seed-cat-freelance", name: "Freelance", type: "INCOME", color: "#0d9488" },
  { id: "seed-cat-moradia", name: "Moradia", type: "EXPENSE", color: "#7c3aed" },
  { id: "seed-cat-alimentacao", name: "Alimentação", type: "EXPENSE", color: "#ea580c" },
  { id: "seed-cat-transporte", name: "Transporte", type: "EXPENSE", color: "#2563eb" },
  { id: "seed-cat-saude", name: "Saúde", type: "EXPENSE", color: "#dc2626" },
  { id: "seed-cat-lazer", name: "Lazer", type: "EXPENSE", color: "#db2777" },
  { id: "seed-cat-educacao", name: "Educação", type: "EXPENSE", color: "#ca8a04" },
  { id: "seed-cat-outros", name: "Outros", type: "EXPENSE", color: "#64748b" },
];

type SeedTx = {
  description: string;
  amountCents: number;
  category: string; // sufixo do id da categoria
  daysAgo: number;
  status?: TransactionStatus;
  notes?: string;
};

// 21 transações espalhadas pelos últimos ~85 dias.
const transactions: SeedTx[] = [
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 2 },
  { description: "Aluguel", amountCents: 140000, category: "moradia", daysAgo: 1, status: "PENDING" },
  { description: "Conta de luz", amountCents: 18990, category: "moradia", daysAgo: 0, status: "PENDING" },
  { description: "Supermercado", amountCents: 52340, category: "alimentacao", daysAgo: 3 },
  { description: "Lanche com a galera", amountCents: 4590, category: "alimentacao", daysAgo: 1 },
  { description: "Ônibus (recarga)", amountCents: 12000, category: "transporte", daysAgo: 4 },
  { description: "Curso online", amountCents: 9700, category: "educacao", daysAgo: 5, notes: "Curso de React" },
  { description: "Site pra cliente", amountCents: 80000, category: "freelance", daysAgo: 6, status: "PENDING" },
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 32 },
  { description: "Aluguel", amountCents: 140000, category: "moradia", daysAgo: 31 },
  { description: "Supermercado", amountCents: 61220, category: "alimentacao", daysAgo: 35 },
  { description: "Uber", amountCents: 3850, category: "transporte", daysAgo: 38 },
  { description: "Farmácia", amountCents: 7480, category: "saude", daysAgo: 40 },
  { description: "Cinema", amountCents: 6000, category: "lazer", daysAgo: 42 },
  { description: "Freelance de design", amountCents: 35000, category: "freelance", daysAgo: 45 },
  { description: "Salário", amountCents: 450000, category: "salario", daysAgo: 62 },
  { description: "Aluguel", amountCents: 140000, category: "moradia", daysAgo: 61 },
  { description: "Supermercado", amountCents: 48760, category: "alimentacao", daysAgo: 66 },
  { description: "Gasolina", amountCents: 25000, category: "transporte", daysAgo: 70 },
  { description: "Consulta médica", amountCents: 25000, category: "saude", daysAgo: 75 },
  { description: "Presente de aniversário", amountCents: 12990, category: "outros", daysAgo: 85 },
];

const budgets = [
  { id: "seed-bud-moradia", category: "moradia", limitCents: 160000 },
  { id: "seed-bud-alimentacao", category: "alimentacao", limitCents: 50000 },
  { id: "seed-bud-transporte", category: "transporte", limitCents: 30000 },
];

/** Dia de N dias atrás (calendário de São Paulo), às 12:00 UTC. */
function daysAgoUtc(days: number): Date {
  const hoje = dateInputToUtc(todayInput());
  return new Date(hoje.getTime() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  const typeOf = new Map(categories.map((c) => [c.id, c.type]));

  for (const c of categories) {
    const { id, ...data } = c;
    await prisma.category.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  for (const [i, t] of transactions.entries()) {
    const id = `seed-tx-${String(i + 1).padStart(2, "0")}`;
    const categoryId = `seed-cat-${t.category}`;
    const data = {
      description: t.description,
      amountCents: t.amountCents,
      type: typeOf.get(categoryId)!,
      status: t.status ?? "PAID",
      date: daysAgoUtc(t.daysAgo),
      categoryId,
      notes: t.notes ?? null,
    };
    await prisma.transaction.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  const month = currentMonth();
  for (const b of budgets) {
    const data = { categoryId: `seed-cat-${b.category}`, month, limitCents: b.limitCents };
    await prisma.budget.upsert({ where: { id: b.id }, create: { id: b.id, ...data }, update: data });
  }

  const [nc, nt, nb] = await Promise.all([
    prisma.category.count(),
    prisma.transaction.count(),
    prisma.budget.count(),
  ]);
  console.log(`Seed ok: ${nc} categorias, ${nt} transações, ${nb} orçamentos (mês ${month}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
