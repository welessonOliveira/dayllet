"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Category, Wallet } from "@prisma/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  CATEGORY_TYPE_LABEL,
  type CategoryType,
  WALLET_KIND_LABEL,
} from "@/lib/constants";
import { toDateInput, todayInput } from "@/lib/dates";
import { centsToInput, formatBRL, parseBRLToCents } from "@/lib/money";
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  splitInstallments,
} from "@/lib/recurrence";
import {
  type RecurringRuleFormOutput,
  type RecurringRuleFormValues,
  recurringRuleSchema,
} from "@/lib/validations";
import {
  createRecurringRuleAction,
  updateRecurringRuleAction,
} from "@/server/actions/recurring";
import type { RecurringRuleView } from "@/server/recurring";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

type RecurringFormModalProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  wallets: Wallet[];
  editingRule?: RecurringRuleView | null;
};

const FIELD_DOM_IDS: Record<keyof RecurringRuleFormValues, string> = {
  kind: "rec-kind-FIXED",
  type: "rec-type-EXPENSE",
  description: "rec-description",
  amount: "rec-amount",
  categoryId: "rec-category",
  walletId: "rec-wallet",
  frequency: "rec-frequency",
  startDate: "rec-start-date",
  endDate: "rec-end-date",
  installments: "rec-installments",
  notes: "rec-notes",
};

export function RecurringFormModal({
  open,
  onClose,
  categories,
  wallets,
  editingRule,
}: RecurringFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const defaultWalletId =
    wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";

  const form = useForm<
    RecurringRuleFormValues,
    unknown,
    RecurringRuleFormOutput
  >({
    resolver: zodResolver(recurringRuleSchema),
    shouldFocusError: false,
    defaultValues: {
      kind: "FIXED",
      description: "",
      type: "EXPENSE",
      amount: "",
      categoryId: "",
      walletId: defaultWalletId,
      frequency: "MONTHLY",
      startDate: todayInput(),
      endDate: "",
      installments: "12",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    const fallbackWalletId =
      wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";

    if (editingRule) {
      const isInstallment = editingRule.installments !== null;
      form.reset({
        kind: isInstallment ? "INSTALLMENT" : "FIXED",
        description: editingRule.description,
        type: editingRule.type,
        amount: centsToInput(editingRule.amountCents),
        categoryId: editingRule.categoryId,
        walletId: editingRule.walletId,
        frequency: editingRule.frequency,
        startDate: toDateInput(new Date(editingRule.startDate)),
        endDate: editingRule.endDate
          ? toDateInput(new Date(editingRule.endDate))
          : "",
        installments: editingRule.installments
          ? String(editingRule.installments)
          : "12",
        notes: editingRule.notes ?? "",
      });
    } else {
      form.reset({
        kind: "FIXED",
        description: "",
        type: "EXPENSE",
        amount: "",
        categoryId: "",
        walletId: fallbackWalletId,
        frequency: "MONTHLY",
        startDate: todayInput(),
        endDate: "",
        installments: "12",
        notes: "",
      });
    }
  }, [open, editingRule, wallets, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const selectedKind = form.watch("kind") || "FIXED";
  const selectedType = form.watch("type") || "EXPENSE";
  const watchedAmount = form.watch("amount") || "";
  const watchedInstallments = form.watch("installments") || "";

  const filteredCategories = categories.filter((c) => c.type === selectedType);

  // Prévia exata das parcelas usando splitInstallments (sem float)
  let installmentPreview: string | null = null;
  if (selectedKind === "INSTALLMENT") {
    const totalCents = parseBRLToCents(watchedAmount);
    const count = Number(watchedInstallments);
    if (
      totalCents !== null &&
      totalCents > 0 &&
      Number.isInteger(count) &&
      count >= 2 &&
      count <= 120
    ) {
      const parts = splitInstallments(totalCents, count);
      const first = parts[0];
      const last = parts[count - 1];
      installmentPreview =
        first === last
          ? `${count}x de ${formatBRL(first)}`
          : `${count - 1}x de ${formatBRL(first)} + 1x de ${formatBRL(last)}`;
    }
  }

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

    const result = editingRule
      ? await updateRecurringRuleAction(editingRule.id, rawValues)
      : await createRecurringRuleAction(rawValues);

    if (result.ok) {
      toast.success(result.message);
      onClose();
      return;
    }

    setServerError(result.error);
    toast.error(result.error);

    if (result.fieldErrors) {
      const validFields = Object.keys(
        FIELD_DOM_IDS,
      ) as (keyof RecurringRuleFormValues)[];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof RecurringRuleFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof RecurringRuleFormValues, {
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
      keyof RecurringRuleFormValues,
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
      title={
        editingRule
          ? "Editar regra recorrente"
          : "Nova conta fixa ou parcelamento"
      }
      subtitle="Gere lançamentos automáticos todos os meses"
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

        {/* Modalidade: Conta fixa ou Parcelado */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Modalidade
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            {(
              [
                { value: "FIXED", label: "Conta fixa" },
                { value: "INSTALLMENT", label: "Parcelado" },
              ] as const
            ).map((opt) => {
              const active = selectedKind === opt.value;
              return (
                <button
                  key={opt.value}
                  id={`rec-kind-${opt.value}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    form.setValue("kind", opt.value, { shouldDirty: true })
                  }
                  className={`min-h-11 rounded-xl py-2 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    active
                      ? "bg-white text-violet-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tipo: Despesa / Receita */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tipo de lançamento
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            {(["EXPENSE", "INCOME"] as const).map((t) => {
              const active = selectedType === t;
              return (
                <button
                  key={t}
                  id={`rec-type-${t}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleTypeSwitch(t)}
                  className={`min-h-11 rounded-xl py-2 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    active
                      ? t === "EXPENSE"
                        ? "bg-white text-rose-600 shadow-xs"
                        : "bg-white text-emerald-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {CATEGORY_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label
            htmlFor="rec-description"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Descrição
          </label>
          <input
            id="rec-description"
            data-autofocus
            type="text"
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description ? "rec-description-error" : undefined
            }
            placeholder={
              selectedKind === "INSTALLMENT"
                ? "Ex.: Celular novo, Notebook, Curso anual"
                : "Ex.: Aluguel, Internet fibra, Salário"
            }
            {...form.register("description")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.description?.message && (
            <p
              id="rec-description-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Valor + (Parcelas se parcelado | Frequência se conta fixa) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="rec-amount"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {selectedKind === "INSTALLMENT"
                ? "Valor total (R$)"
                : "Valor de cada vez (R$)"}
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
                R$
              </span>
              <input
                id="rec-amount"
                type="text"
                inputMode="decimal"
                placeholder={
                  selectedKind === "INSTALLMENT" ? "2.400,00" : "150,00"
                }
                aria-invalid={Boolean(errors.amount) || undefined}
                aria-describedby={
                  errors.amount ? "rec-amount-error" : undefined
                }
                {...form.register("amount")}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {errors.amount?.message && (
              <p
                id="rec-amount-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.amount.message}
              </p>
            )}
          </div>

          {selectedKind === "INSTALLMENT" ? (
            <div>
              <label
                htmlFor="rec-installments"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Número de parcelas
              </label>
              <input
                id="rec-installments"
                type="number"
                min={2}
                max={120}
                inputMode="numeric"
                placeholder="12"
                aria-invalid={Boolean(errors.installments) || undefined}
                aria-describedby={
                  errors.installments ? "rec-installments-error" : undefined
                }
                {...form.register("installments")}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
              {errors.installments?.message && (
                <p
                  id="rec-installments-error"
                  className="mt-1 text-xs font-medium text-rose-600"
                >
                  {errors.installments.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label
                htmlFor="rec-frequency"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Frequência
              </label>
              <select
                id="rec-frequency"
                aria-invalid={Boolean(errors.frequency) || undefined}
                aria-describedby={
                  errors.frequency ? "rec-frequency-error" : undefined
                }
                {...form.register("frequency")}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {FREQUENCIES.map((freq) => (
                  <option key={freq} value={freq}>
                    {FREQUENCY_LABEL[freq]}
                  </option>
                ))}
              </select>
              {errors.frequency?.message && (
                <p
                  id="rec-frequency-error"
                  className="mt-1 text-xs font-medium text-rose-600"
                >
                  {errors.frequency.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Prévia das parcelas no parcelado */}
        {selectedKind === "INSTALLMENT" && installmentPreview && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-xs text-violet-900">
            <span className="font-semibold">Prévia das parcelas: </span>
            <strong className="font-bold tabular-nums">
              {installmentPreview}
            </strong>
          </div>
        )}

        {/* Datas: Início e Fim opcional (só na conta fixa) */}
        <div
          className={`grid gap-4 ${
            selectedKind === "FIXED" ? "sm:grid-cols-2" : "sm:grid-cols-1"
          }`}
        >
          <div>
            <label
              htmlFor="rec-start-date"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {selectedKind === "INSTALLMENT"
                ? "Data da 1ª parcela"
                : "Primeira ocorrência"}
            </label>
            <input
              id="rec-start-date"
              type="date"
              aria-invalid={Boolean(errors.startDate) || undefined}
              aria-describedby={
                errors.startDate ? "rec-start-error" : undefined
              }
              {...form.register("startDate")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {errors.startDate?.message && (
              <p
                id="rec-start-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.startDate.message}
              </p>
            )}
          </div>

          {selectedKind === "FIXED" && (
            <div>
              <label
                htmlFor="rec-end-date"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Repetir até{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="rec-end-date"
                type="date"
                aria-invalid={Boolean(errors.endDate) || undefined}
                aria-describedby={errors.endDate ? "rec-end-error" : undefined}
                {...form.register("endDate")}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {errors.endDate?.message ? (
                <p
                  id="rec-end-error"
                  className="mt-1 text-xs font-medium text-rose-600"
                >
                  {errors.endDate.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Em branco = repete sem data de término.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Conta e Categoria */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="rec-wallet"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Conta
            </label>
            <select
              id="rec-wallet"
              aria-invalid={Boolean(errors.walletId) || undefined}
              aria-describedby={errors.walletId ? "rec-wallet-error" : undefined}
              {...form.register("walletId")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (Padrão)" : ""} —{" "}
                  {WALLET_KIND_LABEL[w.kind]}
                </option>
              ))}
            </select>
            {errors.walletId?.message && (
              <p
                id="rec-wallet-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.walletId.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="rec-category"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Categoria de {CATEGORY_TYPE_LABEL[selectedType].toLowerCase()}
            </label>
            {filteredCategories.length === 0 ? (
              <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Nenhuma categoria de{" "}
                {CATEGORY_TYPE_LABEL[selectedType].toLowerCase()} cadastrada.{" "}
                <Link
                  href="/categorias"
                  className="inline-flex min-h-9 items-center rounded-lg px-1 font-semibold underline hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                >
                  Criar categoria
                </Link>
              </div>
            ) : (
              <select
                id="rec-category"
                aria-invalid={Boolean(errors.categoryId) || undefined}
                aria-describedby={
                  errors.categoryId ? "rec-category-error" : undefined
                }
                {...form.register("categoryId")}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Selecione...</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
            {errors.categoryId?.message && (
              <p
                id="rec-category-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.categoryId.message}
              </p>
            )}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label
            htmlFor="rec-notes"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Observações{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="rec-notes"
            rows={2}
            aria-invalid={Boolean(errors.notes) || undefined}
            aria-describedby={errors.notes ? "rec-notes-error" : undefined}
            placeholder="Detalhes do contrato, cartão ou referência..."
            {...form.register("notes")}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.notes?.message && (
            <p
              id="rec-notes-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.notes.message}
            </p>
          )}
        </div>

        {editingRule && (
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            As alterações valem só daqui pra frente: lançamentos anteriores ou
            já pagos não mudam.
          </p>
        )}

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
            disabled={isSubmitting || filteredCategories.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Salvando..."
              : editingRule
                ? "Salvar alterações"
                : selectedKind === "INSTALLMENT"
                  ? "Criar parcelamento"
                  : "Criar conta fixa"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
