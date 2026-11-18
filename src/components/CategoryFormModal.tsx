"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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

  const form = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categorySchema),
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
  }

  const isSubmitting = form.formState.isSubmitting;
  const { errors } = form.formState;

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

        {/* Tipo */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tipo da categoria
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            {(["EXPENSE", "INCOME"] as const).map((t) => {
              const active = selectedType === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={typeLocked && !active}
                  onClick={() =>
                    form.setValue("type", t, { shouldDirty: true })
                  }
                  className={`rounded-xl py-2 text-sm font-semibold transition ${
                    active
                      ? t === "EXPENSE"
                        ? "bg-white text-rose-600 shadow-xs"
                        : "bg-white text-emerald-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                  }`}
                >
                  {CATEGORY_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
          {typeLocked && (
            <p className="mt-1.5 text-xs text-slate-500">
              O tipo não pode ser alterado porque esta categoria já possui
              transações ou orçamentos vinculados.
            </p>
          )}
          {errors.type?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.type.message}
            </p>
          )}
        </div>

        {/* Nome */}
        <div>
          <label
            htmlFor="cat-name"
            className="block text-sm font-semibold text-slate-700"
          >
            Nome da categoria
          </label>
          <input
            id="cat-name"
            type="text"
            placeholder={
              selectedType === "EXPENSE"
                ? "Ex.: Alimentação, Moradia, Lazer"
                : "Ex.: Salário, Freelance, Reembolso"
            }
            {...form.register("name")}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          {errors.name?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Cor */}
        <div>
          <label
            htmlFor="cat-color"
            className="block text-sm font-semibold text-slate-700"
          >
            Cor de identificação{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((hex) => {
              const active = selectedColor.toLowerCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Escolher cor ${hex}`}
                  onClick={() =>
                    form.setValue("color", hex, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className={`h-7 w-7 rounded-full transition ${
                    active
                      ? "ring-2 ring-slate-900 ring-offset-2 scale-105"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: hex }}
                />
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
              className="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
            />
            <input
              id="cat-color"
              type="text"
              placeholder="#7c3aed"
              {...form.register("color")}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
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
                className="rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Limpar
              </button>
            )}
          </div>
          {errors.color?.message && (
            <p className="mt-1 text-xs font-medium text-rose-600">
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
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
