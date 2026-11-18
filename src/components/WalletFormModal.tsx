"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { WALLET_KINDS, WALLET_KIND_LABEL } from "@/lib/constants";
import { centsToInput } from "@/lib/money";
import {
  type WalletFormOutput,
  type WalletFormValues,
  walletSchema,
} from "@/lib/validations";
import {
  createWalletAction,
  updateWalletAction,
} from "@/server/actions/wallets";
import type { WalletWithBalance } from "@/server/wallets";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

type WalletFormModalProps = {
  open: boolean;
  onClose: () => void;
  editingWallet?: WalletWithBalance | null;
};

const FIELD_DOM_IDS: Record<keyof WalletFormValues, string> = {
  name: "wallet-name",
  kind: "wallet-kind-CHECKING",
  openingBalance: "wallet-opening",
};

export function WalletFormModal({
  open,
  onClose,
  editingWallet,
}: WalletFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<WalletFormValues, unknown, WalletFormOutput>({
    resolver: zodResolver(walletSchema),
    shouldFocusError: false,
    defaultValues: {
      name: "",
      kind: "CHECKING",
      openingBalance: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    if (editingWallet) {
      form.reset({
        name: editingWallet.name,
        kind: editingWallet.kind,
        openingBalance: centsToInput(editingWallet.openingBalanceCents),
      });
    } else {
      form.reset({
        name: "",
        kind: "CHECKING",
        openingBalance: "",
      });
    }
  }, [open, editingWallet, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const selectedKind = form.watch("kind") || "CHECKING";

  async function onSubmit() {
    setServerError(null);
    const rawValues = form.getValues();

    const result = editingWallet
      ? await updateWalletAction(editingWallet.id, rawValues)
      : await createWalletAction(rawValues);

    if (result.ok) {
      toast.success(result.message);
      onClose();
      return;
    }

    setServerError(result.error);
    toast.error(result.error);

    if (result.fieldErrors) {
      const validFields: (keyof WalletFormValues)[] = [
        "name",
        "kind",
        "openingBalance",
      ];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (
          validFields.includes(key as keyof WalletFormValues) &&
          messages?.[0]
        ) {
          form.setError(key as keyof WalletFormValues, {
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
      keyof WalletFormValues,
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
      title={editingWallet ? "Editar conta" : "Nova conta"}
      subtitle="Cadastre uma conta corrente, poupança ou carteira"
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

        {/* Nome */}
        <div>
          <label
            htmlFor="wallet-name"
            className="block text-sm font-semibold text-slate-700"
          >
            Nome da conta
          </label>
          <input
            id="wallet-name"
            data-autofocus
            type="text"
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? "wallet-name-error" : undefined}
            placeholder="Ex.: Conta principal, Reserva, Carteira"
            {...form.register("name")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          {errors.name?.message && (
            <p
              id="wallet-name-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Tipo da conta */}
        <div>
          <span className="block text-sm font-semibold text-slate-700">
            Tipo da conta
          </span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {WALLET_KINDS.map((k) => {
              const active = selectedKind === k;
              return (
                <button
                  key={k}
                  id={`wallet-kind-${k}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    form.setValue("kind", k, { shouldDirty: true })
                  }
                  className={`flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    active
                      ? "border-violet-300 bg-violet-50 text-violet-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {WALLET_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
          {errors.kind?.message && (
            <p
              id="wallet-kind-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.kind.message}
            </p>
          )}
        </div>

        {/* Saldo inicial (pode ser zero ou negativo) */}
        <div>
          <label
            htmlFor="wallet-opening"
            className="block text-sm font-semibold text-slate-700"
          >
            Saldo inicial (R$){" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">
              R$
            </span>
            <input
              id="wallet-opening"
              type="text"
              placeholder="0,00"
              aria-invalid={Boolean(errors.openingBalance) || undefined}
              aria-describedby={
                errors.openingBalance
                  ? "wallet-opening-error"
                  : "wallet-opening-hint"
              }
              {...form.register("openingBalance")}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
            />
          </div>
          {errors.openingBalance?.message ? (
            <p
              id="wallet-opening-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.openingBalance.message}
            </p>
          ) : (
            <p id="wallet-opening-hint" className="mt-1 text-xs text-slate-500">
              Saldo antes dos lançamentos no app. Aceita zero ou valor negativo
              (ex.: 1.500,00 ou -200,00).
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
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Salvando..."
              : editingWallet
                ? "Salvar alterações"
                : "Criar conta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
