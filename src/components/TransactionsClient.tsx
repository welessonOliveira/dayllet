"use client";

import type { Category } from "@prisma/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  CATEGORY_TYPE_LABEL,
  type CategoryType,
  statusLabel,
} from "@/lib/constants";
import { formatDate, formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { TransactionFilters } from "@/lib/validations";
import {
  deleteTransactionAction,
  setTransactionStatusAction,
} from "@/server/actions/transactions";
import type { TransactionWithCategory } from "@/server/transactions";
import { ConfirmDialog } from "./ConfirmDialog";
import { MonthSelector } from "./MonthSelector";
import { useToast } from "./Toast";
import { TransactionFormModal } from "./TransactionFormModal";

type TransactionsClientProps = {
  transactions: TransactionWithCategory[];
  categories: Category[];
  filters: TransactionFilters;
};

export function TransactionsClient({
  transactions,
  categories,
  filters,
}: TransactionsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [isFilterPending, startFilterTransition] = useTransition();

  const [searchText, setSearchText] = useState(filters.q ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionWithCategory | null>(
    null,
  );
  const [deletingTx, setDeletingTx] = useState<TransactionWithCategory | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    setSearchText(filters.q ?? "");
  }, [filters.q]);

  function applyFilters(next: Partial<TransactionFilters>) {
    const merged: TransactionFilters = {
      month: next.month ?? filters.month,
      type: "type" in next ? next.type : filters.type,
      categoryId: "categoryId" in next ? next.categoryId : filters.categoryId,
      q: "q" in next ? next.q : filters.q,
    };

    const sp = new URLSearchParams();
    sp.set("month", merged.month);
    if (merged.type) sp.set("type", merged.type);
    if (merged.categoryId) sp.set("categoryId", merged.categoryId);
    if (merged.q?.trim()) sp.set("q", merged.q.trim());

    startFilterTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  function clearFilters() {
    setSearchText("");
    const sp = new URLSearchParams();
    sp.set("month", filters.month);
    startFilterTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  const hasActiveFilters = Boolean(
    filters.type || filters.categoryId || filters.q,
  );

  const visibleFilterCategories = filters.type
    ? categories.filter((c) => c.type === filters.type)
    : categories;

  async function handleToggleStatus(tx: TransactionWithCategory) {
    const nextStatus = tx.status === "PAID" ? "PENDING" : "PAID";
    setTogglingId(tx.id);
    try {
      const result = await setTransactionStatusAction(tx.id, nextStatus);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingTx) return;
    setIsDeleting(true);
    try {
      const result = await deleteTransactionAction(deletingTx.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletingTx(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  // Soma inteira em centavos dos itens listados no filtro atual
  let listedIncomeCents = 0;
  let listedExpenseCents = 0;
  for (const tx of transactions) {
    if (tx.type === "INCOME") listedIncomeCents += tx.amountCents;
    else listedExpenseCents += tx.amountCents;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Transações
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Extrato de{" "}
            <span className="font-medium text-slate-700">
              {formatMonthLabel(filters.month)}
            </span>{" "}
            ·{" "}
            {transactions.length === 1
              ? "1 lançamento"
              : `${transactions.length} lançamentos`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector
            month={filters.month}
            extraParams={{
              type: filters.type,
              categoryId: filters.categoryId,
              q: filters.q,
            }}
          />
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
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
            <span>Nova transação</span>
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      <section
        aria-label="Filtros de transações"
        className={`rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-opacity sm:p-5 ${
          isFilterPending ? "opacity-70" : ""
        }`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Busca por texto */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters({ q: searchText.trim() || undefined });
            }}
            className="flex gap-2 lg:col-span-5"
          >
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar na descrição..."
                aria-label="Buscar na descrição"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3 pl-9 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={isFilterPending}
              className="rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              Buscar
            </button>
          </form>

          {/* Filtro de Tipo */}
          <div className="lg:col-span-3">
            <select
              aria-label="Filtrar por tipo"
              value={filters.type ?? ""}
              onChange={(e) => {
                const nextType =
                  e.target.value === "INCOME" || e.target.value === "EXPENSE"
                    ? (e.target.value as CategoryType)
                    : undefined;
                const keepCat =
                  !nextType ||
                  categories.some(
                    (c) => c.id === filters.categoryId && c.type === nextType,
                  );
                applyFilters({
                  type: nextType,
                  categoryId: keepCat ? filters.categoryId : undefined,
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Todos os tipos</option>
              <option value="EXPENSE">Somente despesas</option>
              <option value="INCOME">Somente receitas</option>
            </select>
          </div>

          {/* Filtro de Categoria */}
          <div className="lg:col-span-4">
            <select
              aria-label="Filtrar por categoria"
              value={filters.categoryId ?? ""}
              onChange={(e) => {
                applyFilters({
                  categoryId: e.target.value || undefined,
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Todas as categorias</option>
              {visibleFilterCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({CATEGORY_TYPE_LABEL[cat.type]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumo rápido dos resultados + botão limpar filtros */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span className="text-slate-500">
              Receitas na lista:{" "}
              <strong className="font-semibold text-emerald-600">
                {formatBRL(listedIncomeCents)}
              </strong>
            </span>
            <span className="text-slate-500">
              Despesas na lista:{" "}
              <strong className="font-semibold text-rose-600">
                {formatBRL(listedExpenseCents)}
              </strong>
            </span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-semibold text-violet-600 hover:text-violet-700 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      {/* Lista de transações */}
      {transactions.length === 0 ? (
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            {hasActiveFilters
              ? "Nenhuma transação encontrada com esses filtros"
              : `Nenhuma transação em ${formatMonthLabel(filters.month)}`}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {hasActiveFilters
              ? "Tente ajustar ou limpar os filtros aplicados para ver outros lançamentos."
              : "Comece registrando sua primeira receita ou despesa deste mês."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setFormOpen(true);
              }}
              className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700"
            >
              Nova transação
            </button>
          )}
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          {/* Tabela Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5">Data</th>
                  <th className="px-4 py-3.5">Descrição</th>
                  <th className="px-4 py-3.5">Categoria</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isIncome = tx.type === "INCOME";
                  const isPaid = tx.status === "PAID";
                  const isToggling = togglingId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-500 tabular-nums">
                        {formatDate(new Date(tx.date))}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {tx.description}
                        </p>
                        {tx.notes && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {tx.notes}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: tx.category.color || "#7c3aed",
                            }}
                          />
                          {tx.category.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isIncome
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {CATEGORY_TYPE_LABEL[tx.type]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleStatus(tx)}
                          title="Clique para alternar a situação"
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                            isPaid
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isPaid ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          <span>
                            {isToggling
                              ? "Salvando..."
                              : statusLabel(tx.type, tx.status)}
                          </span>
                        </button>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums ${
                          isIncome ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isIncome ? "+ " : "- "}
                        {formatBRL(tx.amountCents)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(tx);
                              setFormOpen(true);
                            }}
                            aria-label={`Editar ${tx.description}`}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-violet-700"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTx(tx)}
                            aria-label={`Excluir ${tx.description}`}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lista Mobile (cards empilhados) */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {transactions.map((tx) => {
              const isIncome = tx.type === "INCOME";
              const isPaid = tx.status === "PAID";
              const isToggling = togglingId === tx.id;

              return (
                <li key={tx.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {tx.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: tx.category.color || "#7c3aed",
                            }}
                          />
                          {tx.category.name}
                        </span>
                        <span>·</span>
                        <span>{CATEGORY_TYPE_LABEL[tx.type]}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {formatDate(new Date(tx.date))}
                        </span>
                      </div>
                      {tx.notes && (
                        <p className="mt-1 text-xs text-slate-500">
                          {tx.notes}
                        </p>
                      )}
                    </div>

                    <p
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        isIncome ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {isIncome ? "+ " : "- "}
                      {formatBRL(tx.amountCents)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleStatus(tx)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                        isPaid
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isPaid ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span>
                        {isToggling
                          ? "Salvando..."
                          : statusLabel(tx.type, tx.status)}
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTx(tx);
                          setFormOpen(true);
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTx(tx)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Modal de criar / editar transação */}
      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTx(null);
        }}
        categories={categories}
        editingTransaction={editingTx}
        defaultMonth={filters.month}
      />

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={Boolean(deletingTx)}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Excluir transação?"
        description={
          deletingTx ? (
            <>
              Tem certeza de que deseja excluir{" "}
              <strong className="font-semibold text-slate-900">
                {deletingTx.description}
              </strong>{" "}
              no valor de{" "}
              <strong className="font-semibold text-slate-900 tabular-nums">
                {formatBRL(deletingTx.amountCents)}
              </strong>
              ? Essa ação não pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel="Sim, excluir transação"
      />
    </div>
  );
}
