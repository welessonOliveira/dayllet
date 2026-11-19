// "Dicas do mês" do Início: contas atrasadas/vencendo, fatura perto do vencimento e
// categorias que subiram ou caíram em relação ao mês anterior. Sempre com { db, userId }.
import { formatDate, type Month, currentMonth, dateInputToUtc, monthRange, shiftMonth, todayInput } from "@/lib/dates";
import { addDaysInput, biggestCategoryChanges } from "@/lib/insights";
import { formatBRL } from "@/lib/money";
import { listCardInvoices } from "./cards";
import type { Ctx } from "./context";

export type Insight = {
  id: string;
  /** warning = precisa de atenção · good = notícia boa · info = neutro */
  tone: "warning" | "good" | "info";
  title: string;
  detail: string;
  href: string;
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

async function gastosPorCategoria(ctx: Ctx, start: Date, end: Date) {
  const grupos = await ctx.db.transaction.groupBy({
    by: ["categoryId"],
    where: { userId: ctx.userId, type: "EXPENSE", date: { gte: start, lt: end } },
    _sum: { amountCents: true },
  });
  const cats = await ctx.db.category.findMany({
    where: { userId: ctx.userId, id: { in: grupos.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  });
  const nome = new Map(cats.map((c) => [c.id, c.name]));
  return new Map(
    grupos.map((g) => [g.categoryId, { name: nome.get(g.categoryId) ?? "Categoria", cents: g._sum.amountCents ?? 0 }]),
  );
}

/** Até 4 dicas pro mês escolhido (as de vencimento olham sempre pra hoje). */
export async function getInsights(ctx: Ctx, month: Month, now: Date = new Date()): Promise<Insight[]> {
  const out: Insight[] = [];
  const hoje = todayInput(now);
  const inicioHoje = new Date(dateInputToUtc(hoje).getTime() - 12 * 3600 * 1000);
  const fimSemana = new Date(dateInputToUtc(addDaysInput(hoje, 7)).getTime() + 12 * 3600 * 1000);

  // 1) Despesas pendentes atrasadas e vencendo nos próximos 7 dias.
  const pendentes = await ctx.db.transaction.findMany({
    where: { userId: ctx.userId, type: "EXPENSE", status: "PENDING", date: { lt: fimSemana } },
    select: { amountCents: true, date: true },
  });
  const atrasadas = pendentes.filter((t) => t.date < inicioHoje);
  const vencendo = pendentes.filter((t) => t.date >= inicioHoje);
  const soma = (xs: { amountCents: number }[]) => xs.reduce((s, t) => s + t.amountCents, 0);
  if (atrasadas.length > 0) {
    out.push({
      id: "atrasadas",
      tone: "warning",
      title: `${atrasadas.length} ${plural(atrasadas.length, "conta atrasada", "contas atrasadas")}`,
      detail: `${formatBRL(soma(atrasadas))} com data que já passou e ainda não foi marcado como pago.`,
      href: `/transacoes?month=${currentMonth(now)}&type=EXPENSE`,
    });
  }
  if (vencendo.length > 0) {
    out.push({
      id: "vencendo",
      tone: "info",
      title: `${vencendo.length} ${plural(vencendo.length, "conta vence", "contas vencem")} em até 7 dias`,
      detail: `Total de ${formatBRL(soma(vencendo))} pra pagar nos próximos dias.`,
      href: `/transacoes?month=${currentMonth(now)}&type=EXPENSE`,
    });
  }

  // 2) Faturas de cartão fechadas, ainda não pagas, vencendo em até 7 dias (ou vencidas).
  const cards = await listCardInvoices(ctx, now);
  for (const { wallet, invoices } of cards) {
    for (const inv of invoices) {
      const falta = inv.totalCents - inv.paidCents;
      if (falta <= 0) continue;
      if (inv.status === "OVERDUE") {
        out.push({
          id: `fatura-${wallet.id}-${inv.month}`,
          tone: "warning",
          title: `Fatura do ${wallet.name} vencida`,
          detail: `Venceu em ${formatDate(inv.dueDate)}. Falta pagar ${formatBRL(falta)}.`,
          href: "/contas",
        });
      } else if (inv.status === "CLOSED" && inv.dueDate < fimSemana) {
        out.push({
          id: `fatura-${wallet.id}-${inv.month}`,
          tone: "info",
          title: `Fatura do ${wallet.name} vence em ${formatDate(inv.dueDate)}`,
          detail: `Valor a pagar: ${formatBRL(falta)}.`,
          href: "/contas",
        });
      }
    }
  }

  // 3) Categoria que mais subiu / caiu em relação ao mês anterior.
  // No mês atual, compara com o mesmo pedaço do mês passado (dia 1 até o dia de hoje).
  const atual = monthRange(month);
  const anterior = monthRange(shiftMonth(month, -1));
  let fimAtual = atual.end;
  let fimAnterior = anterior.end;
  if (month === currentMonth(now)) {
    fimAtual = new Date(dateInputToUtc(hoje).getTime() + 12 * 3600 * 1000);
    const dias = (fimAtual.getTime() - atual.start.getTime()) / 86_400_000;
    fimAnterior = new Date(Math.min(anterior.start.getTime() + dias * 86_400_000, anterior.end.getTime()));
  }
  const [cur, prev] = await Promise.all([
    gastosPorCategoria(ctx, atual.start, fimAtual),
    gastosPorCategoria(ctx, anterior.start, fimAnterior),
  ]);
  const { up, down } = biggestCategoryChanges(cur, prev);
  const comparado = month === currentMonth(now) ? "no mesmo período do mês passado" : "no mês anterior";
  if (up) {
    out.push({
      id: `sobe-${up.categoryId}`,
      tone: "warning",
      title: `${up.name} subiu ${up.percent}%`,
      detail: `${formatBRL(up.currentCents)} agora, contra ${formatBRL(up.previousCents)} ${comparado}.`,
      href: `/transacoes?month=${month}&type=EXPENSE&categoryId=${up.categoryId}`,
    });
  }
  if (down) {
    out.push({
      id: `cai-${down.categoryId}`,
      tone: "good",
      title: down.currentCents === 0 ? `Nenhum gasto com ${down.name} ainda` : `${down.name} caiu ${Math.abs(down.percent)}%`,
      detail: `${formatBRL(down.currentCents)} agora, contra ${formatBRL(down.previousCents)} ${comparado}.`,
      href: `/transacoes?month=${month}&type=EXPENSE&categoryId=${down.categoryId}`,
    });
  }

  return out.slice(0, 4);
}
