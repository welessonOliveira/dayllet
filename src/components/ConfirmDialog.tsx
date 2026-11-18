"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  warning?: ReactNode;
  warningTone?: "amber" | "red";
  confirmTone?: "danger" | "primary";
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  warningTone = "amber",
  confirmTone = "danger",
  confirmLabel = "Sim, excluir",
  loadingLabel,
  cancelLabel = "Cancelar",
  loading = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const busyText =
    loadingLabel ?? (confirmTone === "danger" ? "Excluindo..." : "Salvando...");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={loading}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {description}
        </div>

        {warning && (
          <div
            className={`rounded-2xl border p-3.5 text-sm leading-relaxed ${
              warningTone === "red"
                ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            }`}
          >
            {warning}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-autofocus={confirmDisabled ? true : undefined}
            disabled={loading}
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          {!confirmDisabled && (
            <button
              type="button"
              data-autofocus
              disabled={loading}
              onClick={onConfirm}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                confirmTone === "primary"
                  ? "bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500"
                  : "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500"
              }`}
            >
              {loading ? busyText : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
