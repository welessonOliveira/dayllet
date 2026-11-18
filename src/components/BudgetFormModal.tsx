"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Category } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";
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

  const form = useForm<BudgetFormValues, unknown, BudgetFormOutput>({
    resolver: zodResolver(budgetSchema),
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
  }

  const isSubmitting = form.formState.isSubmitting;
  const { errors } = form.formState;

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
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {serverError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          >
            {serverError}
          </div>
        )}

        {/* Categoria de despesa */}
        <div>
          <label
            htmlFor="bud-category"
            className="block text-sm font-semibold text-slate-700"
          >
            Categoria de despesa
          </label>
          {expenseCategories.length === 0 ? (
            <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Nenhuma categoria de despesa cadastrada.{" "}
              <Link
                href="/categorias"
                className="font-semibold underline hover:text-amber-950"
              >
                Criar categoria de despesa
              </Link>
            </div>
          ) : (
            <select
              id="bud-category"
              {...form.register("categoryId")}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
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
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.categoryId.message}
            </p>
          )}
        </div>

        {/* Mês e Limite */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="bud-month"
              className="block text-sm font-semibold text-slate-700"
            >
              Mês de referência
            </label>
            <input
              id="bud-month"
              type="month"
              {...form.register("month")}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            {errors.month?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.month.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="bud-limit"
              className="block text-sm font-semibold text-slate-700"
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
                {...form.register("limit")}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 tabular-nums outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            {errors.limit?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.limit.message}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          O progresso do orçamento considera todas as despesas da categoria no
          mês, tanto pagas quanto pendentes.
        </p>

        {/* Botões */}
        <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || expenseCategories.length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
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
