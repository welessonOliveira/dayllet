"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Category } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  CATEGORY_TYPE_LABEL,
  type CategoryType,
  TRANSACTION_STATUSES,
  statusLabel,
} from "@/lib/constants";
import { currentMonth, toDateInput, todayInput } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import {
  type TransactionFormOutput,
  type TransactionFormValues,
  transactionSchema,
} from "@/lib/validations";
import {
  createTransactionAction,
  updateTransactionAction,
} from "@/server/actions/transactions";
import type { TransactionWithCategory } from "@/server/transactions";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

type TransactionFormModalProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  editingTransaction?: TransactionWithCategory | null;
  defaultMonth: string;
};

export function TransactionFormModal({
  open,
  onClose,
  categories,
  editingTransaction,
  defaultMonth,
}: TransactionFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultDate =
    defaultMonth === currentMonth() ? todayInput() : `${defaultMonth}-01`;

  const form = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: "",
      type: "EXPENSE",
      status: "PAID",
      date: defaultDate,
      categoryId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    if (editingTransaction) {
      form.reset({
        description: editingTransaction.description,
        amount: centsToInput(editingTransaction.amountCents),
        type: editingTransaction.type,
        status: editingTransaction.status,
        date: toDateInput(new Date(editingTransaction.date)),
        categoryId: editingTransaction.categoryId,
        notes: editingTransaction.notes ?? "",
      });
    } else {
      form.reset({
        description: "",
        amount: "",
        type: "EXPENSE",
        status: "PAID",
        date:
          defaultMonth === currentMonth() ? todayInput() : `${defaultMonth}-01`,
        categoryId: "",
        notes: "",
      });
    }
  }, [open, editingTransaction, defaultMonth, form]);

  const selectedType = form.watch("type") || "EXPENSE";
  const selectedStatus = form.watch("status") || "PAID";
  const filteredCategories = categories.filter((c) => c.type === selectedType);

  function handleTypeSwitch(nextType: CategoryType) {
    if (nextType === selectedType) return;
    form.setValue("type", nextType, { shouldDirty: true });
    const currentCatId = form.getValues("categoryId");
    const stillValid = categories.some(
      (c) => c.id === currentCatId && c.type === nextType,
    );
    if (!stillValid) {
      form.setValue("categoryId", "", { shouldValidate: false });
      form.clearErrors("categoryId");
    }
  }

  async function onSubmit() {
    setServerError(null);
    const rawValues = form.getValues();

    const result = editingTransaction
      ? await updateTransactionAction(editingTransaction.id, rawValues)
      : await createTransactionAction(rawValues);

    if (result.ok) {
      toast.success(result.message);
      onClose();
      return;
    }

    setServerError(result.error);
    toast.error(result.error);

    if (result.fieldErrors) {
      const validFields: (keyof TransactionFormValues)[] = [
        "description",
        "amount",
        "type",
        "status",
        "date",
        "categoryId",
        "notes",
      ];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof TransactionFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof TransactionFormValues, {
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
      title={editingTransaction ? "Editar transação" : "Nova transação"}
      subtitle="Preencha os dados do lançamento financeiro"
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

        {/* Tipo: Despesa / Receita */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tipo de lançamento
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            {(["EXPENSE", "INCOME"] as const).map((t) => {
              const active = selectedType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeSwitch(t)}
                  className={`rounded-xl py-2 text-sm font-semibold transition ${
                    active
                      ? t === "EXPENSE"
                        ? "bg-white text-rose-600 shadow-xs"
                        : "bg-white text-emerald-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {CATEGORY_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
          {errors.type?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.type.message}
            </p>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label
            htmlFor="tx-description"
            className="block text-sm font-semibold text-slate-700"
          >
            Descrição
          </label>
          <input
            id="tx-description"
            type="text"
            placeholder={
              selectedType === "EXPENSE"
                ? "Ex.: Supermercado, Aluguel, Conta de luz"
                : "Ex.: Salário, Projeto freelance"
            }
            {...form.register("description")}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          {errors.description?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Valor e Data */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tx-amount"
              className="block text-sm font-semibold text-slate-700"
            >
              Valor (R$)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
                R$
              </span>
              <input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                {...form.register("amount")}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 tabular-nums outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            {errors.amount?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.amount.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tx-date"
              className="block text-sm font-semibold text-slate-700"
            >
              Data
            </label>
            <input
              id="tx-date"
              type="date"
              {...form.register("date")}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            {errors.date?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {errors.date.message}
              </p>
            )}
          </div>
        </div>

        {/* Categoria filtrada pelo tipo escolhido */}
        <div>
          <label
            htmlFor="tx-category"
            className="block text-sm font-semibold text-slate-700"
          >
            Categoria de {CATEGORY_TYPE_LABEL[selectedType].toLowerCase()}
          </label>
          {filteredCategories.length === 0 ? (
            <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Nenhuma categoria de{" "}
              {CATEGORY_TYPE_LABEL[selectedType].toLowerCase()} cadastrada.{" "}
              <Link
                href="/categorias"
                className="font-semibold underline hover:text-amber-950"
              >
                Criar categoria
              </Link>
            </div>
          ) : (
            <select
              id="tx-category"
              {...form.register("categoryId")}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Selecione uma categoria...</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
          {errors.categoryId?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.categoryId.message}
            </p>
          )}
        </div>

        {/* Status (Pago/Pendente ou Recebido/A receber conforme o tipo) */}
        <div>
          <span className="block text-sm font-semibold text-slate-700">
            Situação
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {TRANSACTION_STATUSES.map((st) => {
              const active = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() =>
                    form.setValue("status", st, { shouldDirty: true })
                  }
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? st === "PAID"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      st === "PAID" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span>{statusLabel(selectedType, st)}</span>
                </button>
              );
            })}
          </div>
          {errors.status?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.status.message}
            </p>
          )}
        </div>

        {/* Observações */}
        <div>
          <label
            htmlFor="tx-notes"
            className="block text-sm font-semibold text-slate-700"
          >
            Observações{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="tx-notes"
            rows={2}
            placeholder="Detalhes adicionais, parcela, forma de pagamento..."
            {...form.register("notes")}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          {errors.notes?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.notes.message}
            </p>
          )}
        </div>

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
            disabled={isSubmitting || filteredCategories.length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Salvando..."
              : editingTransaction
                ? "Salvar alterações"
                : "Criar transação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
