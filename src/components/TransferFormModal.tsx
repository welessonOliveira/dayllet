"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Wallet } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { WALLET_KIND_LABEL } from "@/lib/constants";
import { todayInput } from "@/lib/dates";
import {
  type TransferFormOutput,
  type TransferFormValues,
  transferSchema,
} from "@/lib/validations";
import { createTransferAction } from "@/server/actions/transfers";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

const FIELD_DOM_IDS: Record<keyof TransferFormValues, string> = {
  fromWalletId: "tr-from-wallet",
  toWalletId: "tr-to-wallet",
  amount: "tr-amount",
  date: "tr-date",
  note: "tr-note",
};

type TransferFormModalProps = {
  open: boolean;
  onClose: () => void;
  wallets: Wallet[];
};

export function TransferFormModal({
  open,
  onClose,
  wallets,
}: TransferFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const defaultFrom =
    wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";
  const defaultTo = wallets.find((w) => w.id !== defaultFrom)?.id ?? "";

  const form = useForm<TransferFormValues, unknown, TransferFormOutput>({
    resolver: zodResolver(transferSchema),
    shouldFocusError: false,
    defaultValues: {
      fromWalletId: defaultFrom,
      toWalletId: defaultTo,
      amount: "",
      date: todayInput(),
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    const fromId =
      wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";
    const toId = wallets.find((w) => w.id !== fromId)?.id ?? "";

    form.reset({
      fromWalletId: fromId,
      toWalletId: toId,
      amount: "",
      date: todayInput(),
      note: "",
    });
  }, [open, wallets, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const watchedFrom = form.watch("fromWalletId") || "";

  async function onSubmit() {
    setServerError(null);
    const rawValues = form.getValues();

    const result = await createTransferAction(rawValues);
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
      ) as (keyof TransferFormValues)[];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof TransferFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof TransferFormValues, {
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
      keyof TransferFormValues,
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
      title="Transferir entre contas"
      subtitle="Move dinheiro de uma conta sua para outra"
      maxWidthClass="max-w-md"
    >
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="space-y-4"
      >
        <p className="rounded-2xl bg-violet-50/75 px-3.5 py-2.5 text-xs leading-relaxed text-violet-900">
          Transferência <strong>não é receita nem despesa</strong>: altera
          apenas o saldo das duas contas, sem afetar o resultado do mês nem os
          orçamentos.
        </p>

        {showErrorSummary && (
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
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

        {/* Conta de origem e destino */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tr-from-wallet"
              className="block text-sm font-semibold text-slate-700"
            >
              Conta de origem
            </label>
            <select
              id="tr-from-wallet"
              aria-invalid={Boolean(errors.fromWalletId) || undefined}
              aria-describedby={
                errors.fromWalletId ? "tr-from-error" : undefined
              }
              {...form.register("fromWalletId", {
                onChange: (e) => {
                  const nextFrom = e.target.value;
                  if (form.getValues("toWalletId") === nextFrom) {
                    const alt = wallets.find((w) => w.id !== nextFrom);
                    if (alt) form.setValue("toWalletId", alt.id);
                  }
                },
              })}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({WALLET_KIND_LABEL[w.kind]})
                </option>
              ))}
            </select>
            {errors.fromWalletId?.message && (
              <p
                id="tr-from-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.fromWalletId.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tr-to-wallet"
              className="block text-sm font-semibold text-slate-700"
            >
              Conta de destino
            </label>
            <select
              id="tr-to-wallet"
              aria-invalid={Boolean(errors.toWalletId) || undefined}
              aria-describedby={errors.toWalletId ? "tr-to-error" : undefined}
              {...form.register("toWalletId")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <option value="">Selecione...</option>
              {wallets
                .filter((w) => w.id !== watchedFrom)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({WALLET_KIND_LABEL[w.kind]})
                  </option>
                ))}
            </select>
            {errors.toWalletId?.message && (
              <p
                id="tr-to-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.toWalletId.message}
              </p>
            )}
          </div>
        </div>

        {/* Valor e Data */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tr-amount"
              className="block text-sm font-semibold text-slate-700"
            >
              Valor (R$)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
                R$
              </span>
              <input
                id="tr-amount"
                data-autofocus
                type="text"
                inputMode="decimal"
                placeholder="100,00"
                aria-invalid={Boolean(errors.amount) || undefined}
                aria-describedby={errors.amount ? "tr-amount-error" : undefined}
                {...form.register("amount")}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {errors.amount?.message && (
              <p
                id="tr-amount-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.amount.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tr-date"
              className="block text-sm font-semibold text-slate-700"
            >
              Data
            </label>
            <input
              id="tr-date"
              type="date"
              aria-invalid={Boolean(errors.date) || undefined}
              aria-describedby={errors.date ? "tr-date-error" : undefined}
              {...form.register("date")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
            />
            {errors.date?.message && (
              <p
                id="tr-date-error"
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
            htmlFor="tr-note"
            className="block text-sm font-semibold text-slate-700"
          >
            Observação{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            id="tr-note"
            type="text"
            placeholder="Ex.: Saque no caixa, guardar na poupança..."
            aria-invalid={Boolean(errors.note) || undefined}
            aria-describedby={errors.note ? "tr-note-error" : undefined}
            {...form.register("note")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          {errors.note?.message && (
            <p
              id="tr-note-error"
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || wallets.length < 2}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Transferindo..." : "Confirmar transferência"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
