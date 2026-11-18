"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Category } from "@prisma/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { centsToInput } from "@/lib/money";
import {
  type BudgetFormOutput,
  type BudgetFormValues,
  budgetSchema,
} from "@/lib/validations";
import {
  createBudgetAction,
  updateBudgetAction,
} from "@/server/actions/budgets";
import type { BudgetWithProgress } from "@/server/budgets";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

type BudgetFormModalProps = {
  open: boolean;
  onClose: () => void;
  expenseCategories: Category[];
  editingBudget?: BudgetWithProgress | null;
  defaultMonth: string;
  existingCategoryIdsInMonth: string[];
};

const FIELD_DOM_IDS: Record<keyof BudgetFormValues, string> = {
  categoryId: "bud-category",
  month: "bud-month",
  limit: "bud-limit",
};

export function BudgetFormModal({
  open,
  onClose,
  expenseCategories,
  editingBudget,
  defaultMonth,
  existingCategoryIdsInMonth,
}: BudgetFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<BudgetFormValues, unknown, BudgetFormOutput>({
    resolver: zodResolver(budgetSchema),
    shouldFocusError: false,
    defaultValues: {
      categoryId: "",
      month: defaultMonth,
      limit: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    if (editingBudget) {
      form.reset({
        categoryId: editingBudget.categoryId,
        month: editingBudget.month,
        limit: centsToInput(editingBudget.limitCents),
      });
    } else {
      form.reset({
        categoryId: "",
        month: defaultMonth,
        limit: "",
      });
    }
  }, [open, editingBudget, defaultMonth, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const watchedMonth = form.watch("month");

  async function onSubmit() {
    setServerError(null);
    const rawValues = form.getValues();

    const result = editingBudget
      ? await updateBudgetAction(editingBudget.id, rawValues)
      : await createBudgetAction(rawValues);

    if (result.ok) {
      toast.success(result.message);
      onClose();
      return;
    }

    setServerError(result.error);
    toast.error(result.error);

    if (result.fieldErrors) {
      const validFields: (keyof BudgetFormValues)[] = [
        "categoryId",
        "month",
        "limit",
      ];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof BudgetFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof BudgetFormValues, {
            type: "server",
            message: messages[0],
          });
        }
      }
    }

    focusErrorSummary();
  }

  function onInvalid() {
    focusErrorSummary();
  }

  const isSubmitting = form.formState.isSubmitting;
  const { errors, submitCount } = form.formState;

  const fieldErrorEntries = (
    Object.entries(errors) as [
      keyof BudgetFormValues,
      { message?: string } | undefined,
    ][]
  ).filter(([, err]) => Boolean(err?.message));

  const showErrorSummary =
    Boolean(serverError) || (submitCount > 0 && fieldErrorEntries.length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={isSubmitting}
      title={editingBudget ? "Editar orçamento" : "Novo orçamento mensal"}
      subtitle="Defina o teto de gastos para uma categoria de despesa"
      maxWidthClass="max-w-md"
    >
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="space-y-4"
      >
        {showErrorSummary && (
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            <p className="font-semibold text-rose-900">
              {serverError ?? "Confira os campos destacados antes de salvar:"}
            </p>
            {fieldErrorEntries.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs">
                {fieldErrorEntries.map(([field, err]) => (
                  <li key={field}>
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById(FIELD_DOM_IDS[field])?.focus()
                      }
                      className="text-left font-medium underline underline-offset-2 hover:text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      {err?.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Categoria de despesa */}
        <div>
          <label
            htmlFor="bud-category"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Categoria de despesa
          </label>
          {expenseCategories.length === 0 ? (
            <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Nenhuma categoria de despesa cadastrada.{" "}
              <Link
                href="/categorias"
                className="inline-flex min-h-9 items-center rounded-lg px-1 font-semibold underline hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
              >
                Criar categoria de despesa
              </Link>
            </div>
          ) : (
            <select
              id="bud-category"
              data-autofocus
              aria-invalid={Boolean(errors.categoryId) || undefined}
              aria-describedby={
                errors.categoryId ? "bud-category-error" : undefined
              }
              {...form.register("categoryId")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Selecione uma categoria...</option>
              {expenseCategories.map((cat) => {
                const alreadyExists =
                  !editingBudget &&
                  watchedMonth === defaultMonth &&
                  existingCategoryIdsInMonth.includes(cat.id);
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {alreadyExists ? " (já possui orçamento neste mês)" : ""}
                  </option>
                );
              })}
            </select>
          )}
          {errors.categoryId?.message && (
            <p
              id="bud-category-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.categoryId.message}
            </p>
          )}
        </div>

        {/* Mês e Limite */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="bud-month"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Mês de referência
            </label>
            <input
              id="bud-month"
              type="month"
              aria-invalid={Boolean(errors.month) || undefined}
              aria-describedby={errors.month ? "bud-month-error" : undefined}
              {...form.register("month")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {errors.month?.message && (
              <p
                id="bud-month-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.month.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="bud-limit"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Limite mensal (R$)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
                R$
              </span>
              <input
                id="bud-limit"
                type="text"
                inputMode="decimal"
                placeholder="800,00"
                aria-invalid={Boolean(errors.limit) || undefined}
                aria-describedby={errors.limit ? "bud-limit-error" : undefined}
                {...form.register("limit")}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {errors.limit?.message && (
              <p
                id="bud-limit-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.limit.message}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          O progresso do orçamento considera todas as despesas da categoria no
          mês, tanto pagas quanto pendentes.
        </p>

        {/* Botões */}
        <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || expenseCategories.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Salvando..."
              : editingBudget
                ? "Salvar alterações"
                : "Criar orçamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
