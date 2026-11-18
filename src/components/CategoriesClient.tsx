"use client";

import Link from "next/link";
import { useState } from "react";
import type { CategoryType } from "@/lib/constants";
import { deleteCategoryAction } from "@/server/actions/categories";
import type { CategoryWithCounts } from "@/server/categories";
import { CategoryFormModal } from "./CategoryFormModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

type CategoriesClientProps = {
  income: CategoryWithCounts[];
  expense: CategoryWithCounts[];
};

export function CategoriesClient({ income, expense }: CategoriesClientProps) {
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<CategoryType>("EXPENSE");
  const [editingCat, setEditingCat] = useState<CategoryWithCounts | null>(null);
  const [deletingCat, setDeletingCat] = useState<CategoryWithCounts | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreate(type: CategoryType) {
    setEditingCat(null);
    setDefaultType(type);
    setFormOpen(true);
  }

  function openEdit(cat: CategoryWithCounts) {
    setEditingCat(cat);
    setDefaultType(cat.type);
    setFormOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingCat) return;
    setIsDeleting(true);
    try {
      const result = await deleteCategoryAction(deletingCat.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletingCat(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  const totalCount = income.length + expense.length;

  const blockedByTransactions = Boolean(
    deletingCat && deletingCat.transactionCount > 0,
  );
  const hasLinkedBudgets = Boolean(
    deletingCat &&
      deletingCat.transactionCount === 0 &&
      deletingCat.budgetCount > 0,
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Categorias
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount === 1
              ? "1 categoria cadastrada"
              : `${totalCount} categorias cadastradas`}{" "}
            ({income.length} de receita e {expense.length} de despesa)
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreate("EXPENSE")}
          className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700 sm:self-auto"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          <span>Nova categoria</span>
        </button>
      </div>

      {/* Duas listas separadas: Receitas e Despesas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista de Receitas */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Receitas</h2>
                <p className="text-xs text-slate-500">
                  {income.length}{" "}
                  {income.length === 1 ? "categoria" : "categorias"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreate("INCOME")}
              className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              + Receita
            </button>
          </div>

          {income.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Nenhuma categoria de receita
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Crie categorias como Salário ou Freelance para organizar suas
                entradas.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {income.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-2 ring-slate-100"
                      style={{ backgroundColor: cat.color || "#16a34a" }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {cat.name}
                      </p>
                      <Link
                        href={`/transacoes?type=INCOME&categoryId=${cat.id}`}
                        className="text-xs text-slate-500 hover:text-violet-600 hover:underline"
                      >
                        {cat.transactionCount === 1
                          ? "1 transação"
                          : `${cat.transactionCount} transações`}
                      </Link>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      aria-label={`Editar categoria ${cat.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-violet-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCat(cat)}
                      aria-label={`Excluir categoria ${cat.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Lista de Despesas */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Despesas</h2>
                <p className="text-xs text-slate-500">
                  {expense.length}{" "}
                  {expense.length === 1 ? "categoria" : "categorias"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreate("EXPENSE")}
              className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              + Despesa
            </button>
          </div>

          {expense.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Nenhuma categoria de despesa
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Crie categorias como Moradia, Alimentação ou Transporte.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expense.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-2 ring-slate-100"
                      style={{ backgroundColor: cat.color || "#7c3aed" }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {cat.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <Link
                          href={`/transacoes?type=EXPENSE&categoryId=${cat.id}`}
                          className="hover:text-violet-600 hover:underline"
                        >
                          {cat.transactionCount === 1
                            ? "1 transação"
                            : `${cat.transactionCount} transações`}
                        </Link>
                        {cat.budgetCount > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              {cat.budgetCount === 1
                                ? "1 orçamento"
                                : `${cat.budgetCount} orçamentos`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      aria-label={`Editar categoria ${cat.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-violet-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCat(cat)}
                      aria-label={`Excluir categoria ${cat.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Modal criar / editar */}
      <CategoryFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingCat(null);
        }}
        editingCategory={editingCat}
        defaultType={defaultType}
      />

      {/* Confirmação de exclusão com avisos de transações e orçamentos */}
      <ConfirmDialog
        open={Boolean(deletingCat)}
        onClose={() => setDeletingCat(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        confirmDisabled={blockedByTransactions}
        cancelLabel={blockedByTransactions ? "Entendi" : "Cancelar"}
        confirmLabel={
          hasLinkedBudgets
            ? "Sim, excluir categoria e orçamentos"
            : "Sim, excluir categoria"
        }
        title={
          blockedByTransactions
            ? "Não é possível excluir esta categoria"
            : "Excluir categoria?"
        }
        description={
          deletingCat ? (
            blockedByTransactions ? (
              <>
                A categoria{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingCat.name}
                </strong>{" "}
                possui{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingCat.transactionCount === 1
                    ? "1 transação vinculada"
                    : `${deletingCat.transactionCount} transações vinculadas`}
                </strong>{" "}
                e não pode ser excluída.
              </>
            ) : (
              <>
                Tem certeza de que deseja excluir a categoria{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingCat.name}
                </strong>
                ? Essa ação não pode ser desfeita.
              </>
            )
          ) : null
        }
        warningTone={blockedByTransactions ? "red" : "amber"}
        warning={
          deletingCat ? (
            blockedByTransactions ? (
              <div className="space-y-2">
                <p>
                  Para excluir esta categoria, primeiro mude essas transações
                  para outra categoria ou exclua-as na tela de Transações.
                </p>
                <Link
                  href={`/transacoes?categoryId=${deletingCat.id}`}
                  onClick={() => setDeletingCat(null)}
                  className="inline-block font-semibold underline hover:text-rose-950"
                >
                  Ver transações desta categoria →
                </Link>
              </div>
            ) : hasLinkedBudgets ? (
              <p>
                <strong>Atenção:</strong>{" "}
                {deletingCat.budgetCount === 1
                  ? "1 orçamento cadastrado para esta categoria também será apagado junto com ela."
                  : `${deletingCat.budgetCount} orçamentos cadastrados para esta categoria também serão apagados junto com ela.`}
              </p>
            ) : undefined
          ) : undefined
        }
      />
    </div>
  );
}
