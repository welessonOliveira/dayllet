"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { todayInput } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import {
  type GoalContributionFormOutput,
  type GoalContributionFormValues,
  goalContributionSchema,
} from "@/lib/validations";
import { addGoalContributionAction } from "@/server/actions/goals";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

const FIELD_DOM_IDS: Record<keyof GoalContributionFormValues, string> = {
  kind: "contrib-kind-DEPOSIT",
  amount: "contrib-amount",
  date: "contrib-date",
  note: "contrib-note",
};

type GoalContributionModalProps = {
  open: boolean;
  onClose: () => void;
  goal: { id: string; name: string; savedCents: number } | null;
  defaultKind?: "DEPOSIT" | "WITHDRAW";
};

export function GoalContributionModal({
  open,
  onClose,
  goal,
  defaultKind = "DEPOSIT",
}: GoalContributionModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<
    GoalContributionFormValues,
    unknown,
    GoalContributionFormOutput
  >({
    resolver: zodResolver(goalContributionSchema),
    shouldFocusError: false,
    defaultValues: {
      kind: defaultKind,
      amount: "",
      date: todayInput(),
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset({
      kind: defaultKind,
      amount: "",
      date: todayInput(),
      note: "",
    });
  }, [open, defaultKind, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const selectedKind = form.watch("kind") || "DEPOSIT";

  async function onSubmit() {
    if (!goal) return;
    setServerError(null);
    const rawValues = form.getValues();

    const result = await addGoalContributionAction(goal.id, rawValues);
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
      ) as (keyof GoalContributionFormValues)[];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof GoalContributionFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof GoalContributionFormValues, {
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
      keyof GoalContributionFormValues,
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
      title={goal ? `Movimentar: ${goal.name}` : "Movimentar meta"}
      subtitle={
        goal
          ? `Saldo atual guardado: ${formatBRL(goal.savedCents)}`
          : undefined
      }
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

        {/* Toggle Guardar / Retirar */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Operação
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            {(
              [
                { value: "DEPOSIT", label: "Guardar" },
                { value: "WITHDRAW", label: "Retirar" },
              ] as const
            ).map((opt) => {
              const active = selectedKind === opt.value;
              return (
                <button
                  key={opt.value}
                  id={`contrib-kind-${opt.value}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    form.setValue("kind", opt.value, { shouldDirty: true })
                  }
                  className={`min-h-11 rounded-xl py-2 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    active
                      ? opt.value === "DEPOSIT"
                        ? "bg-white text-emerald-600 shadow-xs"
                        : "bg-white text-amber-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Valor e Data */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="contrib-amount"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Valor (R$)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
                R$
              </span>
              <input
                id="contrib-amount"
                data-autofocus
                type="text"
                inputMode="decimal"
                placeholder="200,00"
                aria-invalid={Boolean(errors.amount) || undefined}
                aria-describedby={
                  errors.amount ? "contrib-amount-error" : undefined
                }
                {...form.register("amount")}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {errors.amount?.message && (
              <p
                id="contrib-amount-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.amount.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="contrib-date"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Data
            </label>
            <input
              id="contrib-date"
              type="date"
              aria-invalid={Boolean(errors.date) || undefined}
              aria-describedby={errors.date ? "contrib-date-error" : undefined}
              {...form.register("date")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {errors.date?.message && (
              <p
                id="contrib-date-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.date.message}
              </p>
            )}
          </div>
        </div>

        {/* Observação */}
        <div>
          <label
            htmlFor="contrib-note"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Observação{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            id="contrib-note"
            type="text"
            placeholder="Ex.: Sobrou do salário, 13º..."
            aria-invalid={Boolean(errors.note) || undefined}
            aria-describedby={errors.note ? "contrib-note-error" : undefined}
            {...form.register("note")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.note?.message && (
            <p
              id="contrib-note-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.note.message}
            </p>
          )}
        </div>

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
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Salvando..."
              : selectedKind === "DEPOSIT"
                ? "Guardar valor"
                : "Retirar valor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
