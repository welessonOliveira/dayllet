"use client";

import type { Category } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";
import { formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { deleteBudgetAction } from "@/server/actions/budgets";
import type { BudgetWithProgress } from "@/server/budgets";
import { BudgetFormModal } from "./BudgetFormModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { MonthSelector } from "./MonthSelector";
import { useToast } from "./Toast";

type BudgetsClientProps = {
  month: string;
  budgets: BudgetWithProgress[];
  expenseCategories: Category[];
};

export function BudgetsClient({
  month,
  budgets,
  expenseCategories,
}: BudgetsClientProps) {
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(
    null,
  );
  const [deletingBudget, setDeletingBudget] =
    useState<BudgetWithProgress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deletingBudget) return;
    setIsDeleting(true);
    try {
      const result = await deleteBudgetAction(deletingBudget.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletingBudget(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  // Somas em centavos (inteiros) apenas para exibir o resumo geral dos orçamentos
  let totalLimitCents = 0;
  let totalSpentCents = 0;
  let overCount = 0;
  for (const b of budgets) {
    totalLimitCents += b.progress.limitCents;
    totalSpentCents += b.progress.spentCents;
    if (b.progress.isOver) overCount += 1;
  }

  const existingCategoryIds = budgets.map((b) => b.categoryId);

  return (
    <div className="space-y-6">
      {/* Cabeçalho + seletor de mês */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Orçamentos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Limites de gastos para{" "}
            <span className="font-medium text-slate-700">
              {formatMonthLabel(month)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector month={month} />
          <button
            type="button"
            onClick={() => {
              setEditingBudget(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span>Novo orçamento</span>
          </button>
        </div>
      </div>

      {/* Resumo rápido dos orçamentos do mês */}
      {budgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total planejado
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {formatBRL(totalLimitCents)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Soma dos limites de {budgets.length}{" "}
              {budgets.length === 1 ? "categoria" : "categorias"}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total comprometido
            </span>
            <p
              className={`mt-2 text-2xl font-bold tabular-nums ${
                totalSpentCents > totalLimitCents
                  ? "text-rose-600"
                  : "text-violet-600"
              }`}
            >
              {formatBRL(totalSpentCents)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Despesas pagas e pendentes nas categorias orçadas
            </p>
          </div>

          <div
            className={`rounded-3xl border p-5 shadow-xs ${
              overCount > 0
                ? "border-rose-200 bg-rose-50/60"
                : "border-emerald-200 bg-emerald-50/50"
            }`}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                overCount > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              Situação dos limites
            </span>
            <p
              className={`mt-2 text-2xl font-bold ${
                overCount > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {overCount > 0
                ? `${overCount} ${overCount === 1 ? "estourado" : "estourados"}`
                : "Tudo dentro da meta"}
            </p>
            <p
              className={`mt-1 text-xs ${
                overCount > 0 ? "text-rose-700/80" : "text-emerald-700/80"
              }`}
            >
              {overCount > 0
                ? "Atenção às categorias destacadas em vermelho"
                : "Nenhum orçamento ultrapassou o limite definido"}
            </p>
          </div>
        </div>
      )}

      {/* Lista de cards de orçamento */}
      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Nenhum orçamento em {formatMonthLabel(month)}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Defina metas mensais para categorias como Moradia, Alimentação e
            Transporte para não perder o controle dos gastos.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingBudget(null);
              setFormOpen(true);
            }}
            className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700"
          >
            Criar orçamento
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {budgets.map((b) => {
            const { progress, category } = b;
            const overAmountCents = Math.abs(progress.remainingCents);

            return (
              <article
                key={b.id}
                className={`flex flex-col justify-between rounded-3xl border p-6 shadow-xs transition ${
                  progress.isOver
                    ? "border-rose-300 bg-rose-50/40"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                <div>
                  {/* Topo do card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                        style={{ backgroundColor: category.color || "#7c3aed" }}
                        aria-hidden="true"
                      >
                        {category.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-slate-900">
                          {category.name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          Limite:{" "}
                          <strong className="font-semibold text-slate-700 tabular-nums">
                            {formatBRL(progress.limitCents)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${
                          progress.isOver
                            ? "bg-rose-600 text-white"
                            : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {progress.percentUsed}% usado
                      </span>
                      {progress.isOver && (
                        <span className="text-[11px] font-semibold text-rose-600">
                          Limite ultrapassado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress.isOver ? "bg-rose-600" : "bg-violet-600"
                      }`}
                      style={{ width: `${progress.percentBar}%` }}
                    />
                  </div>

                  {/* Números detalhados: Gasto e Restante */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-slate-200/70">
                    <div>
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Gasto no mês
                      </span>
                      <span
                        className={`mt-0.5 block text-base font-bold tabular-nums ${
                          progress.isOver ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {formatBRL(progress.spentCents)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`block text-[11px] font-semibold uppercase tracking-wide ${
                          progress.isOver ? "text-rose-600" : "text-slate-400"
                        }`}
                      >
                        {progress.isOver ? "Excedido em" : "Restante"}
                      </span>
                      <span
                        className={`mt-0.5 block text-base font-bold tabular-nums ${
                          progress.isOver
                            ? "text-rose-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {progress.isOver
                          ? formatBRL(overAmountCents)
                          : formatBRL(progress.remainingCents)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rodapé de ações */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200/60 pt-3">
                  <Link
                    href={`/transacoes?month=${month}&type=EXPENSE&categoryId=${b.categoryId}`}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 hover:underline"
                  >
                    Ver gastos →
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBudget(b);
                        setFormOpen(true);
                      }}
                      aria-label={`Editar orçamento de ${category.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-violet-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingBudget(b)}
                      aria-label={`Excluir orçamento de ${category.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100/70"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de criar / editar orçamento */}
      <BudgetFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingBudget(null);
        }}
        expenseCategories={expenseCategories}
        editingBudget={editingBudget}
        defaultMonth={month}
        existingCategoryIdsInMonth={existingCategoryIds}
      />

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={Boolean(deletingBudget)}
        onClose={() => setDeletingBudget(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Excluir orçamento?"
        description={
          deletingBudget ? (
            <>
              Deseja excluir o orçamento de{" "}
              <strong className="font-semibold text-slate-900">
                {deletingBudget.category.name}
              </strong>{" "}
              para{" "}
              <strong className="font-semibold text-slate-900">
                {formatMonthLabel(deletingBudget.month)}
              </strong>{" "}
              (limite de {formatBRL(deletingBudget.limitCents)})? Suas
              transações continuarão salvas normalmente.
            </>
          ) : null
        }
        confirmLabel="Sim, excluir orçamento"
      />
    </div>
  );
}
