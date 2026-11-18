// Metas: regra pura + integração.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { dateInputToUtc as d } from "@/lib/dates";
import { calcGoalProgress, monthsUntil } from "@/lib/goals";
import { goalContributionSchema, goalSchema, toGoalContributionData, toGoalData } from "@/lib/validations";
import type { Ctx } from "@/server/context";
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  deleteGoalContribution,
  getGoal,
  listGoals,
  setGoalArchived,
  updateGoal,
} from "@/server/goals";
import { TEST_DATABASE_URL } from "../test-db";

const AGORA = new Date("2026-11-18T15:00:00Z");

describe("progresso da meta (puro)", () => {
  it("meses até a data contam o atual e o final (nov -> mar = 5)", () => {
    expect(monthsUntil(d("2027-03-01"), AGORA)).toBe(5);
    expect(monthsUntil(d("2026-11-30"), AGORA)).toBe(1);
    expect(monthsUntil(d("2026-10-01"), AGORA)).toBe(0);
  });

  it("quanto guardar por mês arredonda PRA CIMA em centavos", () => {
    const p = calcGoalProgress(400000, 100000, d("2027-03-31"), AGORA);
    expect(p).toMatchObject({ remainingCents: 300000, percent: 25, monthsLeft: 5, monthlyNeededCents: 60000, done: false });
    expect(calcGoalProgress(100000, 0, d("2027-01-31"), AGORA).monthlyNeededCents).toBe(33334); // 100000/3 = 33333,33...
  });

  it("concluída, sem prazo e atrasada", () => {
    expect(calcGoalProgress(1000, 1500, null, AGORA)).toMatchObject({ done: true, percent: 150, percentBar: 100, remainingCents: 0, monthlyNeededCents: null });
    expect(calcGoalProgress(1000, 0, null, AGORA)).toMatchObject({ monthsLeft: null, monthlyNeededCents: null, overdue: false });
    expect(calcGoalProgress(1000, 200, d("2026-01-01"), AGORA)).toMatchObject({ overdue: true, monthlyNeededCents: 800 });
  });
});

const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
let ana: Ctx;
let bruno: Ctx;

const meta = (over: Record<string, string> = {}) =>
  toGoalData(goalSchema.parse({ name: "PC novo", target: "4.000,00", targetDate: "2027-03-31", ...over }));
const mov = (amount: string, kind: "DEPOSIT" | "WITHDRAW" = "DEPOSIT") =>
  toGoalContributionData(goalContributionSchema.parse({ kind, amount, date: "2026-11-10" }));

beforeEach(async () => {
  await db.transaction.deleteMany();
  await db.user.deleteMany();
  ana = { db, userId: (await db.user.create({ data: { email: "ana@goal.local" } })).id };
  bruno = { db, userId: (await db.user.create({ data: { email: "bruno@goal.local" } })).id };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("metas (integração)", () => {
  it("guardar e retirar mexem no progresso; não dá pra tirar mais do que tem", async () => {
    const g = await createGoal(ana, meta());
    await addGoalContribution(ana, g.id, mov("1.500,00"));
    await addGoalContribution(ana, g.id, mov("500,00", "WITHDRAW"));
    await expect(addGoalContribution(ana, g.id, mov("2.000,00", "WITHDRAW"))).rejects.toThrow("retirar mais");

    const [l] = await listGoals(ana, {}, AGORA);
    expect(l.progress).toMatchObject({ savedCents: 100000, remainingCents: 300000, percent: 25, monthlyNeededCents: 60000 });
    expect(l.contributionCount).toBe(2);

    const detalhe = (await getGoal(ana, g.id, AGORA))!;
    expect(detalhe.contributions.map((c) => c.amountCents).sort()).toEqual([-50000, 150000].sort());
    // Apagar o depósito deixaria negativo (tem uma retirada): bloqueia.
    const deposito = detalhe.contributions.find((c) => c.amountCents > 0)!;
    await expect(deleteGoalContribution(ana, deposito.id)).rejects.toThrow("negativa");
  });

  it("nome único por usuário, arquivar esconde, concluídas vão pro fim", async () => {
    const a = await createGoal(ana, meta({ name: "Viagem", target: "100,00" }));
    await createGoal(ana, meta());
    await expect(createGoal(ana, meta())).rejects.toThrow("Você já tem uma meta com esse nome.");
    await expect(createGoal(bruno, meta())).resolves.toBeTruthy();

    await addGoalContribution(ana, a.id, mov("100,00"));
    expect((await listGoals(ana, {}, AGORA)).map((g) => g.name)).toEqual(["PC novo", "Viagem"]);
    await setGoalArchived(ana, a.id, true);
    expect(await listGoals(ana, {}, AGORA)).toHaveLength(1);
    expect(await listGoals(ana, { includeArchived: true }, AGORA)).toHaveLength(2);
    await updateGoal(ana, a.id, meta({ name: "Viagem 2027", target: "5.000,00" }));
    await deleteGoal(ana, a.id);
    expect(await db.goalContribution.count()).toBe(0);
  });

  it("isolamento: o Bruno não vê nem mexe nas metas da Ana", async () => {
    const g = await createGoal(ana, meta());
    const c = await addGoalContribution(ana, g.id, mov("10,00"));
    expect(await getGoal(bruno, g.id)).toBeNull();
    expect(await listGoals(bruno)).toHaveLength(0);
    await expect(updateGoal(bruno, g.id, meta())).rejects.toThrow("Meta não encontrada.");
    await expect(addGoalContribution(bruno, g.id, mov("1,00"))).rejects.toThrow("Meta não encontrada.");
    await expect(deleteGoalContribution(bruno, c.id)).rejects.toThrow("Movimentação não encontrada.");
    await expect(deleteGoal(bruno, g.id)).rejects.toThrow("Meta não encontrada.");
  });
});
