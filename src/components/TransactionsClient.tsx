"use client";

import type { Category, Wallet } from "@prisma/client";
import Link from "next/link";
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
import { AttachmentBadge } from "./AttachmentBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { MonthSelector } from "./MonthSelector";
import { useToast } from "./Toast";
import { TransactionFormModal } from "./TransactionFormModal";

type TransactionsClientProps = {
  transactions: TransactionWithCategory[];
  categories: Category[];
  wallets: Wallet[];
  filters: TransactionFilters;
  /** Abre o formulário de nova transação assim que a tela carrega. */
  openNew?: boolean;
};

export function TransactionsClient({
  transactions,
  categories,
  wallets,
  filters,
  openNew = false,
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

  // Botão "+" (barra do celular / menu lateral): abre o formulário e limpa o "?nova=1" da URL,
  // pra não abrir de novo ao atualizar a página.
  useEffect(() => {
    if (!openNew) return;
    setEditingTx(null);
    setFormOpen(true);
    const sp = new URLSearchParams(window.location.search);
    sp.delete("nova");
    const resto = sp.toString();
    router.replace(resto ? `${pathname}?${resto}` : pathname, { scroll: false });
  }, [openNew, pathname, router]);

  function applyFilters(next: Partial<TransactionFilters>) {
    const merged: TransactionFilters = {
      month: next.month ?? filters.month,
      type: "type" in next ? next.type : filters.type,
      categoryId: "categoryId" in next ? next.categoryId : filters.categoryId,
      walletId: "walletId" in next ? next.walletId : filters.walletId,
      q: "q" in next ? next.q : filters.q,
    };

    const sp = new URLSearchParams();
    sp.set("month", merged.month);
    if (merged.type) sp.set("type", merged.type);
    if (merged.categoryId) sp.set("categoryId", merged.categoryId);
    if (merged.walletId) sp.set("walletId", merged.walletId);
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
    filters.type || filters.categoryId || filters.walletId || filters.q,
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

  const csvParams = new URLSearchParams();
  csvParams.set("month", filters.month);
  if (filters.type) csvParams.set("type", filters.type);
  if (filters.categoryId) csvParams.set("categoryId", filters.categoryId);
  if (filters.walletId) csvParams.set("walletId", filters.walletId);
  if (filters.q) csvParams.set("q", filters.q);
  const exportCsvHref = `/api/export/transacoes?${csvParams.toString()}`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            Transações
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
              walletId: filters.walletId,
              q: filters.q,
            }}
          />
          <a
            href={exportCsvHref}
            download
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition motion-reduce:transition-none hover:bg-slate-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:text-sm"
          >
            <svg
              className="h-4 w-4 text-violet-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            <span>Exportar CSV</span>
          </a>
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setFormOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
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
        className={`rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-opacity motion-reduce:transition-none sm:p-5 dark:bg-slate-900 ${
          isFilterPending ? "opacity-70" : ""
        }`}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* Busca por texto */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters({ q: searchText.trim() || undefined });
            }}
            className="flex gap-2 sm:col-span-2 lg:col-span-4"
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
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3 pl-9 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
              />
            </div>
            <button
              type="submit"
              disabled={isFilterPending}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white transition motion-reduce:transition-none hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              Buscar
            </button>
          </form>

          {/* Filtro de Conta */}
          <div className="lg:col-span-3">
            <select
              aria-label="Filtrar por conta"
              value={filters.walletId ?? ""}
              onChange={(e) => {
                applyFilters({
                  walletId: e.target.value || undefined,
                });
              }}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Todas as contas</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (Padrão)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Tipo */}
          <div className="lg:col-span-2">
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
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Todos os tipos</option>
              <option value="EXPENSE">Despesas</option>
              <option value="INCOME">Receitas</option>
            </select>
          </div>

          {/* Filtro de Categoria */}
          <div className="sm:col-span-2 lg:col-span-3">
            <select
              aria-label="Filtrar por categoria"
              value={filters.categoryId ?? ""}
              onChange={(e) => {
                applyFilters({
                  categoryId: e.target.value || undefined,
                });
              }}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
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
              className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-violet-600 transition motion-reduce:transition-none hover:text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:my-0 md:min-h-8"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      {/* Lista de transações */}
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:bg-slate-900 shadow-xs">
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
          <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
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
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
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
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Nova transação
            </button>
          )}
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {/* Tabela Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5">Data</th>
                  <th className="px-4 py-3.5">Descrição</th>
                  <th className="px-4 py-3.5">Conta</th>
                  <th className="px-4 py-3.5">Categoria</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Situação</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => {
                  const isIncome = tx.type === "INCOME";
                  const isPaid = tx.status === "PAID";
                  const isToggling = togglingId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      className="transition motion-reduce:transition-none hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDate(new Date(tx.date))}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {tx.description}
                          </p>
                          {tx.recurringRuleId && (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                              {tx.installmentNo && tx.installmentOf
                                ? `Parcela ${tx.installmentNo}/${tx.installmentOf}`
                                : "Fixa"}
                            </span>
                          )}
                          {tx.attachment && <AttachmentBadge transactionId={tx.id} attachment={tx.attachment} />}
                        </div>
                        {tx.notes && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {tx.notes}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {tx.wallet.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: tx.category.color || "#a67c52",
                            }}
                          />
                          {tx.category.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isIncome
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
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
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                            isPaid
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
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
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(tx);
                              setFormOpen(true);
                            }}
                            aria-label={`Editar ${tx.description}`}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTx(tx)}
                            aria-label={`Excluir ${tx.description}`}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition motion-reduce:transition-none hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
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

          {/* Lista Mobile (cards empilhados com alvos >= 44x44px) */}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
            {transactions.map((tx) => {
              const isIncome = tx.type === "INCOME";
              const isPaid = tx.status === "PAID";
              const isToggling = togglingId === tx.id;

              return (
                <li key={tx.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </p>
                        {tx.recurringRuleId && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            {tx.installmentNo && tx.installmentOf
                              ? `Parcela ${tx.installmentNo}/${tx.installmentOf}`
                              : "Fixa"}
                          </span>
                        )}
                        {tx.attachment && <AttachmentBadge transactionId={tx.id} attachment={tx.attachment} />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: tx.category.color || "#a67c52",
                            }}
                          />
                          {tx.category.name}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-violet-700">
                          {tx.wallet.name}
                        </span>
                        <span>·</span>
                        <span>{CATEGORY_TYPE_LABEL[tx.type]}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {formatDate(new Date(tx.date))}
                        </span>
                      </div>
                      {tx.notes && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleStatus(tx)}
                      className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                        isPaid
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isPaid ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span>
                        {isToggling
                          ? "Salvando..."
                          : statusLabel(tx.type, tx.status)}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTx(tx);
                          setFormOpen(true);
                        }}
                        aria-label={`Editar ${tx.description}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTx(tx)}
                        aria-label={`Excluir ${tx.description}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/60 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 transition motion-reduce:transition-none hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
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
        wallets={wallets}
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
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {deletingTx.description}
              </strong>{" "}
              no valor de{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatBRL(deletingTx.amountCents)}
              </strong>{" "}
              (conta {deletingTx.wallet.name})? Essa ação não pode ser desfeita.
            </>
          ) : null
        }
        warning={
          deletingTx?.recurringRuleId ? (
            <div className="space-y-1.5">
              <p>
                <strong>Lançamento recorrente:</strong> só essa ocorrência some.
                Pra parar as próximas, pause ou exclua a conta fixa ou
                parcelamento em Recorrentes.
              </p>
              <Link
                href="/recorrentes"
                onClick={() => setDeletingTx(null)}
                className="-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
              >
                Ir para Recorrentes →
              </Link>
            </div>
          ) : undefined
        }
        confirmLabel="Sim, excluir transação"
      />
    </div>
  );
}
