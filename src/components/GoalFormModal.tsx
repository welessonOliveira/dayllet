"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Goal } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toDateInput } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import {
  type GoalFormOutput,
  type GoalFormValues,
  goalSchema,
} from "@/lib/validations";
import { createGoalAction, updateGoalAction } from "@/server/actions/goals";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

const PRESET_COLORS = [
  "#a67c52",
  "#2563eb",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#db2777",
  "#4f46e5",
];

const FIELD_DOM_IDS: Record<keyof GoalFormValues, string> = {
  name: "goal-name",
  target: "goal-target",
  targetDate: "goal-target-date",
  color: "goal-color",
};

type GoalFormModalProps = {
  open: boolean;
  onClose: () => void;
  editingGoal?: Goal | null;
};

export function GoalFormModal({
  open,
  onClose,
  editingGoal,
}: GoalFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<GoalFormValues, unknown, GoalFormOutput>({
    resolver: zodResolver(goalSchema),
    shouldFocusError: false,
    defaultValues: {
      name: "",
      target: "",
      targetDate: "",
      color: "#a67c52",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    if (editingGoal) {
      form.reset({
        name: editingGoal.name,
        target: centsToInput(editingGoal.targetCents),
        targetDate: editingGoal.targetDate
          ? toDateInput(new Date(editingGoal.targetDate))
          : "",
        color: editingGoal.color ?? "#a67c52",
      });
    } else {
      form.reset({
        name: "",
        target: "",
        targetDate: "",
        color: "#a67c52",
      });
    }
  }, [open, editingGoal, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const selectedColor = form.watch("color") ?? "";

  async function onSubmit() {
    setServerError(null);
    const rawValues = form.getValues();

    const result = editingGoal
      ? await updateGoalAction(editingGoal.id, rawValues)
      : await createGoalAction(rawValues);

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
      ) as (keyof GoalFormValues)[];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof GoalFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof GoalFormValues, {
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
      keyof GoalFormValues,
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
      title={editingGoal ? "Editar meta" : "Nova meta de economia"}
      subtitle="Defina quanto quer juntar e acompanhe o progresso"
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

        {/* Nome */}
        <div>
          <label
            htmlFor="goal-name"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Nome da meta
          </label>
          <input
            id="goal-name"
            data-autofocus
            type="text"
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? "goal-name-error" : undefined}
            placeholder="Ex.: Reserva de emergência, Viagem, Notebook"
            {...form.register("name")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.name?.message && (
            <p
              id="goal-name-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Valor alvo e Prazo opcional */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="goal-target"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Valor da meta (R$)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
                R$
              </span>
              <input
                id="goal-target"
                type="text"
                inputMode="decimal"
                placeholder="4.000,00"
                aria-invalid={Boolean(errors.target) || undefined}
                aria-describedby={
                  errors.target ? "goal-target-error" : undefined
                }
                {...form.register("target")}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {errors.target?.message && (
              <p
                id="goal-target-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.target.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="goal-target-date"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Prazo{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="goal-target-date"
              type="date"
              aria-invalid={Boolean(errors.targetDate) || undefined}
              aria-describedby={
                errors.targetDate ? "goal-date-error" : undefined
              }
              {...form.register("targetDate")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {errors.targetDate?.message && (
              <p
                id="goal-date-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.targetDate.message}
              </p>
            )}
          </div>
        </div>

        {/* Cor */}
        <div>
          <label
            htmlFor="goal-color"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Cor da meta{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {PRESET_COLORS.map((hex) => {
              const active = selectedColor.toLowerCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Escolher cor ${hex}`}
                  aria-pressed={active}
                  onClick={() =>
                    form.setValue("color", hex, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:h-9 md:w-9"
                >
                  <span
                    className={`h-7 w-7 rounded-full ${
                      active ? "ring-2 ring-slate-900 ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                </button>
              );
            })}
          </div>
          <input
            id="goal-color"
            type="text"
            placeholder="#a67c52"
            aria-invalid={Boolean(errors.color) || undefined}
            aria-describedby={errors.color ? "goal-color-error" : undefined}
            {...form.register("color")}
            className="mt-2.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          {errors.color?.message && (
            <p
              id="goal-color-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.color.message}
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
              : editingGoal
                ? "Salvar alterações"
                : "Criar meta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
