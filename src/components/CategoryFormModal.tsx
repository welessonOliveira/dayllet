"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { CATEGORY_TYPE_LABEL, type CategoryType } from "@/lib/constants";
import {
  type CategoryFormOutput,
  type CategoryFormValues,
  categorySchema,
} from "@/lib/validations";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/server/actions/categories";
import type { CategoryWithCounts } from "@/server/categories";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

const PRESET_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#4f46e5",
  "#64748b",
];

const FIELD_DOM_IDS: Record<keyof CategoryFormValues, string> = {
  type: "cat-type-expense",
  name: "cat-name",
  color: "cat-color",
};

type CategoryFormModalProps = {
  open: boolean;
  onClose: () => void;
  editingCategory?: CategoryWithCounts | null;
  defaultType?: CategoryType;
};

export function CategoryFormModal({
  open,
  onClose,
  editingCategory,
  defaultType = "EXPENSE",
}: CategoryFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categorySchema),
    shouldFocusError: false,
    defaultValues: {
      name: "",
      type: defaultType,
      color: "#7c3aed",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    if (editingCategory) {
      form.reset({
        name: editingCategory.name,
        type: editingCategory.type,
        color: editingCategory.color ?? "",
      });
    } else {
      form.reset({
        name: "",
        type: defaultType,
        color: defaultType === "INCOME" ? "#16a34a" : "#7c3aed",
      });
    }
  }, [open, editingCategory, defaultType, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const selectedType = form.watch("type") || "EXPENSE";
  const selectedColor = form.watch("color") ?? "";

  const typeLocked = Boolean(
    editingCategory &&
      (editingCategory.transactionCount > 0 || editingCategory.budgetCount > 0),
  );

  async function onSubmit() {
    setServerError(null);
    const rawValues = form.getValues();

    const result = editingCategory
      ? await updateCategoryAction(editingCategory.id, rawValues)
      : await createCategoryAction(rawValues);

    if (result.ok) {
      toast.success(result.message);
      onClose();
      return;
    }

    setServerError(result.error);
    toast.error(result.error);

    if (result.fieldErrors) {
      const validFields: (keyof CategoryFormValues)[] = [
        "name",
        "type",
        "color",
      ];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof CategoryFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof CategoryFormValues, {
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
      keyof CategoryFormValues,
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
      title={editingCategory ? "Editar categoria" : "Nova categoria"}
      subtitle="Organize suas receitas e despesas por grupo"
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

        {/* Tipo */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tipo da categoria
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            {(["EXPENSE", "INCOME"] as const).map((t) => {
              const active = selectedType === t;
              return (
                <button
                  key={t}
                  id={t === "EXPENSE" ? "cat-type-expense" : "cat-type-income"}
                  type="button"
                  aria-pressed={active}
                  disabled={typeLocked && !active}
                  onClick={() =>
                    form.setValue("type", t, { shouldDirty: true })
                  }
                  className={`min-h-11 rounded-xl py-2 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    active
                      ? t === "EXPENSE"
                        ? "bg-white text-rose-600 shadow-xs"
                        : "bg-white text-emerald-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                  }`}
                >
                  {CATEGORY_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
          {typeLocked && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              O tipo não pode ser alterado porque esta categoria já possui
              transações ou orçamentos vinculados.
            </p>
          )}
          {errors.type?.message && (
            <p
              id="cat-type-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.type.message}
            </p>
          )}
        </div>

        {/* Nome */}
        <div>
          <label
            htmlFor="cat-name"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Nome da categoria
          </label>
          <input
            id="cat-name"
            data-autofocus
            type="text"
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? "cat-name-error" : undefined}
            placeholder={
              selectedType === "EXPENSE"
                ? "Ex.: Alimentação, Moradia, Lazer"
                : "Ex.: Salário, Freelance, Reembolso"
            }
            {...form.register("name")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.name?.message && (
            <p
              id="cat-name-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Cor */}
        <div>
          <label
            htmlFor="cat-color"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Cor de identificação{" "}
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
                    className={`h-7 w-7 rounded-full transition motion-reduce:transition-none ${
                      active
                        ? "ring-2 ring-slate-900 ring-offset-2 scale-105"
                        : ""
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <input
              type="color"
              aria-label="Seletor visual de cor"
              value={
                /^#[0-9a-fA-F]{6}$/.test(selectedColor)
                  ? selectedColor
                  : "#7c3aed"
              }
              onChange={(e) =>
                form.setValue("color", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            />
            <input
              id="cat-color"
              type="text"
              placeholder="#7c3aed"
              aria-invalid={Boolean(errors.color) || undefined}
              aria-describedby={errors.color ? "cat-color-error" : undefined}
              {...form.register("color")}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
            />
            {selectedColor && (
              <button
                type="button"
                onClick={() =>
                  form.setValue("color", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                Limpar
              </button>
            )}
          </div>
          {errors.color?.message && (
            <p
              id="cat-color-error"
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
              : editingCategory
                ? "Salvar alterações"
                : "Criar categoria"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
