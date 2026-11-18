// Contas fixas e parcelados (Decisão 19). Todas recebem o contexto { db, userId }.
//
// Como funciona a geração "na leitura":
// - Ao abrir uma tela de um mês, syncRecurring cria os lançamentos que faltam
//   de cada regra ativa até o fim daquele mês (nunca além de 24 meses à frente).
// - É idempotente: o índice único (recurringRuleId, occurrenceDate) + skipDuplicates
//   impedem duplicar, mesmo com duas abas abertas ao mesmo tempo.
// - Ocorrência que o usuário apagou vira um RecurringSkip e não volta mais.
// - Ocorrências com data ANTES do dia em que a regra foi criada (histórico) entram
//   como PAGAS; da criação pra frente entram como PENDENTES.
import type { Category, RecurringRule, Wallet } from "@prisma/client";
import { currentMonth, dateInputToUtc, shiftMonth, todayInput, toDateInput } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import {
  type Occurrence,
  describeSchedule,
  occurrenceAmount,
  occurrencesBetween,
  occurrencesUntilMonthEnd,
} from "@/lib/recurrence";
import { checkCategoryType } from "@/lib/rules";
import type { RecurringRuleData } from "@/lib/validations";
import type { Ctx } from "./context";
import { getDefaultWalletId, getOwnWallet } from "./wallets";

/** Até quantos meses à frente do mês atual a geração vai. */
export const MAX_MONTHS_AHEAD = 24;

const NAO_ENCONTRADA = "Conta fixa ou parcelamento não encontrado.";

export type RecurringRuleView = RecurringRule & {
  category: Category;
  wallet: Wallet;
  /** "Todo mês, dia 10", "Parcelado em 10x"... */
  scheduleLabel: string;
  /** Próxima ocorrência a partir de hoje (ou null se acabou). */
  nextDate: Date | null;
  /** Valor da próxima ocorrência (parcela ou valor fixo). */
  nextAmountCents: number | null;
  /** Parcelado: quantas parcelas já estão pagas. */
  paidInstallments: number | null;
  /** true quando não há mais ocorrências (fim ou última parcela já passou). */
  finished: boolean;
};

function hoje(now: Date): Date {
  return dateInputToUtc(todayInput(now));
}

async function getOwnRule(ctx: Ctx, id: string): Promise<RecurringRule> {
  const r = await ctx.db.recurringRule.findFirst({ where: { id, userId: ctx.userId } });
  if (!r) throw new DomainError(NAO_ENCONTRADA);
  return r;
}

/** Confere categoria e conta (do usuário, tipo certo) e resolve a conta padrão. */
async function prepare(ctx: Ctx, data: RecurringRuleData) {
  const categoria = await ctx.db.category.findFirst({ where: { id: data.categoryId, userId: ctx.userId } });
  if (!categoria) throw new DomainError("Categoria não encontrada.");
  const erro = checkCategoryType(data.type, categoria.type);
  if (erro) throw new DomainError(erro);
  const walletId = data.walletId ? (await getOwnWallet(ctx, data.walletId)).id : await getDefaultWalletId(ctx);
  return { ...data, walletId };
}

/** Apaga as ocorrências geradas de hoje em diante que ainda estão PENDENTES. */
async function deleteFuturePending(ctx: Ctx, ruleId: string, now: Date): Promise<number> {
  const r = await ctx.db.transaction.deleteMany({
    where: { userId: ctx.userId, recurringRuleId: ruleId, status: "PENDING", date: { gte: hoje(now) } },
  });
  return r.count;
}

/**
 * Cria os lançamentos que faltam de todas as regras ativas até o fim de `month`
 * (ou do mês atual, o que for maior), limitado a MAX_MONTHS_AHEAD.
 * Devolve quantos lançamentos novos foram criados.
 */
export async function syncRecurring(ctx: Ctx, month?: string, now = new Date()): Promise<number> {
  const atual = currentMonth(now);
  const limite = shiftMonth(atual, MAX_MONTHS_AHEAD);
  let ate = month && month > atual ? month : atual;
  if (ate > limite) ate = limite;

  const rules = await ctx.db.recurringRule.findMany({
    where: { userId: ctx.userId, active: true },
    include: { skips: true },
  });
  if (rules.length === 0) return 0;

  const novos = [];
  for (const rule of rules) {
    const pulados = new Set(rule.skips.map((s) => s.occurrenceDate.getTime()));
    const criadaEm = dateInputToUtc(toDateInput(rule.createdAt));
    for (const occ of occurrencesUntilMonthEnd(rule, ate)) {
      if (pulados.has(occ.date.getTime())) continue;
      novos.push({
        userId: ctx.userId,
        walletId: rule.walletId,
        categoryId: rule.categoryId,
        type: rule.type,
        description: rule.description,
        amountCents: occurrenceAmount(rule, occ.index),
        status: occ.date < criadaEm ? ("PAID" as const) : ("PENDING" as const),
        date: occ.date,
        notes: rule.notes,
        recurringRuleId: rule.id,
        occurrenceDate: occ.date,
        installmentNo: rule.installments ? occ.index + 1 : null,
        installmentOf: rule.installments,
      });
    }
  }
  if (novos.length === 0) return 0;
  const r = await ctx.db.transaction.createMany({ data: novos, skipDuplicates: true });
  return r.count;
}

/** Regras do usuário com o resumo pra tela (ativas primeiro, depois A-Z). */
export async function listRecurringRules(ctx: Ctx, now = new Date()): Promise<RecurringRuleView[]> {
  const rules = await ctx.db.recurringRule.findMany({
    where: { userId: ctx.userId },
    include: { category: true, wallet: true },
    orderBy: [{ active: "desc" }, { description: "asc" }],
  });
  const pagas = await ctx.db.transaction.groupBy({
    by: ["recurringRuleId"],
    where: { userId: ctx.userId, recurringRuleId: { in: rules.map((r) => r.id) }, status: "PAID" },
    _count: { _all: true },
  });
  const pagasPor = new Map(pagas.map((p) => [p.recurringRuleId, p._count._all]));
  const desde = hoje(now);
  const longe = new Date(desde.getTime() + 400 * 24 * 60 * 60 * 1000); // ~13 meses (cobre o anual)

  return rules.map((r) => {
    const proxima: Occurrence | undefined = occurrencesBetween(r, desde, longe, 2000)[0];
    return {
      ...r,
      scheduleLabel: describeSchedule(r),
      nextDate: r.active && proxima ? proxima.date : null,
      nextAmountCents: r.active && proxima ? occurrenceAmount(r, proxima.index) : null,
      paidInstallments: r.installments ? (pagasPor.get(r.id) ?? 0) : null,
      finished: !proxima,
    };
  });
}

export async function getRecurringRule(ctx: Ctx, id: string) {
  return ctx.db.recurringRule.findFirst({
    where: { id, userId: ctx.userId },
    include: { category: true, wallet: true },
  });
}

export async function createRecurringRule(
  ctx: Ctx,
  data: RecurringRuleData,
  now = new Date(),
): Promise<RecurringRule> {
  const pronto = await prepare(ctx, data);
  const rule = await ctx.db.recurringRule.create({ data: { ...pronto, userId: ctx.userId } });
  await syncRecurring(ctx, undefined, now);
  return rule;
}

/**
 * Edita a regra. Vale só pra frente (Decisão 19): o que já passou ou já foi pago
 * fica como está; as ocorrências futuras pendentes são recriadas com os dados novos.
 */
export async function updateRecurringRule(
  ctx: Ctx,
  id: string,
  data: RecurringRuleData,
  now = new Date(),
): Promise<RecurringRule> {
  await getOwnRule(ctx, id);
  const pronto = await prepare(ctx, data);
  await deleteFuturePending(ctx, id, now);
  const rule = await ctx.db.recurringRule.update({ where: { id }, data: pronto });
  await syncRecurring(ctx, undefined, now);
  return rule;
}

/** Pausa (para de gerar e apaga as futuras pendentes) ou retoma a regra. */
export async function setRecurringRuleActive(
  ctx: Ctx,
  id: string,
  active: boolean,
  now = new Date(),
): Promise<RecurringRule> {
  await getOwnRule(ctx, id);
  if (!active) await deleteFuturePending(ctx, id, now);
  const rule = await ctx.db.recurringRule.update({ where: { id }, data: { active } });
  if (active) await syncRecurring(ctx, undefined, now);
  return rule;
}

/**
 * Exclui a regra. As ocorrências futuras pendentes somem; as que já passaram
 * ou foram pagas ficam no histórico (sem vínculo com a regra).
 * Devolve quantos lançamentos futuros foram apagados.
 */
export async function deleteRecurringRule(
  ctx: Ctx,
  id: string,
  now = new Date(),
): Promise<{ deletedFuture: number }> {
  await getOwnRule(ctx, id);
  const deletedFuture = await deleteFuturePending(ctx, id, now);
  await ctx.db.recurringRule.delete({ where: { id } });
  return { deletedFuture };
}
