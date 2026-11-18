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
  confirmLabel?: string;
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
  confirmLabel = "Sim, excluir",
  cancelLabel = "Cancelar",
  loading = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={loading}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-slate-600">
          {description}
        </div>

        {warning && (
          <div
            className={`rounded-2xl border p-3.5 text-sm leading-relaxed ${
              warningTone === "red"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          {!confirmDisabled && (
            <button
              type="button"
              data-autofocus
              disabled={loading}
              onClick={onConfirm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Excluindo..." : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
