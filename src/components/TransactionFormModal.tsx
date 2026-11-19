"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Category, Wallet } from "@prisma/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  CATEGORY_TYPE_LABEL,
  type CategoryType,
  TRANSACTION_STATUSES,
  WALLET_KIND_LABEL,
  statusLabel,
} from "@/lib/constants";
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, formatBytes } from "@/lib/attachments";
import { compressImage } from "@/lib/compressImage";
import { currentMonth, toDateInput, todayInput } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import {
  type TransactionFormOutput,
  type TransactionFormValues,
  transactionSchema,
} from "@/lib/validations";
import { deleteAttachmentAction, uploadAttachmentAction } from "@/server/actions/attachments";
import { suggestCategoryAction } from "@/server/actions/imports";
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
  wallets: Wallet[];
  editingTransaction?: TransactionWithCategory | null;
  defaultMonth: string;
};

const FIELD_DOM_IDS: Record<keyof TransactionFormValues, string> = {
  type: "tx-type-expense",
  description: "tx-description",
  amount: "tx-amount",
  date: "tx-date",
  categoryId: "tx-category",
  walletId: "tx-wallet",
  status: "tx-status-PAID",
  notes: "tx-notes",
};

export function TransactionFormModal({
  open,
  onClose,
  categories,
  wallets,
  editingTransaction,
  defaultMonth,
}: TransactionFormModalProps) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [suggestedCatId, setSuggestedCatId] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  // Comprovante: arquivo novo escolhido e/ou pedido pra tirar o atual.
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defaultDate =
    defaultMonth === currentMonth() ? todayInput() : `${defaultMonth}-01`;
  const defaultWalletId =
    wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";

  const form = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(transactionSchema),
    shouldFocusError: false,
    defaultValues: {
      description: "",
      amount: "",
      type: "EXPENSE",
      status: "PAID",
      date: defaultDate,
      categoryId: "",
      walletId: defaultWalletId,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setSuggestedCatId(null);
    setFile(null);
    setRemoveAttachment(false);
    setFileError(null);

    const fallbackWalletId =
      wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";

    if (editingTransaction) {
      form.reset({
        description: editingTransaction.description,
        amount: centsToInput(editingTransaction.amountCents),
        type: editingTransaction.type,
        status: editingTransaction.status,
        date: toDateInput(new Date(editingTransaction.date)),
        categoryId: editingTransaction.categoryId,
        walletId: editingTransaction.walletId,
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
        walletId: fallbackWalletId,
        notes: "",
      });
    }
  }, [open, editingTransaction, defaultMonth, wallets, form]);

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      const box = errorSummaryRef.current;
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.focus();
    });
  }

  const selectedType = form.watch("type") || "EXPENSE";
  const selectedStatus = form.watch("status") || "PAID";
  const watchedDescription = form.watch("description") || "";
  const watchedCategoryId = form.watch("categoryId") || "";
  const filteredCategories = categories.filter((c) => c.type === selectedType);

  // Sugestão automática de categoria ao digitar descrição (só se categoria estiver vazia)
  useEffect(() => {
    if (!open || editingTransaction) return;
    const text = watchedDescription.trim();
    if (text.length < 3 || form.getValues("categoryId")) return;

    const timer = window.setTimeout(async () => {
      if (form.getValues("categoryId")) return;
      const currentType = form.getValues("type") || "EXPENSE";
      const res = await suggestCategoryAction(text, currentType);
      if (
        res.ok &&
        res.data.categoryId &&
        !form.getValues("categoryId") &&
        categories.some(
          (c) => c.id === res.data.categoryId && c.type === currentType,
        )
      ) {
        form.setValue("categoryId", res.data.categoryId, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setSuggestedCatId(res.data.categoryId);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [open, editingTransaction, watchedDescription, selectedType, categories, form]);

  async function trySuggestOnBlur() {
    const text = (form.getValues("description") || "").trim();
    if (text.length < 2 || form.getValues("categoryId")) return;
    const currentType = form.getValues("type") || "EXPENSE";
    const res = await suggestCategoryAction(text, currentType);
    if (
      res.ok &&
      res.data.categoryId &&
      !form.getValues("categoryId") &&
      categories.some(
        (c) => c.id === res.data.categoryId && c.type === currentType,
      )
    ) {
      form.setValue("categoryId", res.data.categoryId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setSuggestedCatId(res.data.categoryId);
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

    const result = editingTransaction
      ? await updateTransactionAction(editingTransaction.id, rawValues)
      : await createTransactionAction(rawValues);

    if (result.ok) {
      const txId = result.data.id;
      let anexoErro: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await uploadAttachmentAction(txId, fd);
        if (!up.ok) anexoErro = up.error;
      } else if (removeAttachment && editingTransaction?.attachment) {
        const del = await deleteAttachmentAction(txId);
        if (!del.ok) anexoErro = del.error;
      }
      if (anexoErro) toast.error(`${result.message} Mas o comprovante não foi salvo: ${anexoErro}`);
      else toast.success(result.message);
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
        "walletId",
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

    focusErrorSummary();
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0];
    e.target.value = ""; // deixa escolher o mesmo arquivo de novo
    if (!escolhido) return;
    const pronto = await compressImage(escolhido);
    if (pronto.size > ATTACHMENT_MAX_BYTES) {
      setFileError(`Arquivo muito grande (${formatBytes(pronto.size)}). O limite é ${formatBytes(ATTACHMENT_MAX_BYTES)}.`);
      return;
    }
    setFileError(null);
    setFile(pronto);
    setRemoveAttachment(false);
  }

  const atual = editingTransaction?.attachment && !removeAttachment ? editingTransaction.attachment : null;

  function onInvalid() {
    focusErrorSummary();
  }

  const isSubmitting = form.formState.isSubmitting;
  const { errors, submitCount } = form.formState;

  const fieldErrorEntries = (
    Object.entries(errors) as [
      keyof TransactionFormValues,
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
      title={editingTransaction ? "Editar transação" : "Nova transação"}
      subtitle="Preencha os dados do lançamento financeiro"
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
                  id={t === "EXPENSE" ? "tx-type-expense" : "tx-type-income"}
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
          {errors.type?.message && (
            <p
              id="tx-type-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.type.message}
            </p>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label
            htmlFor="tx-description"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Descrição
          </label>
          <input
            id="tx-description"
            data-autofocus
            type="text"
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description ? "tx-description-error" : undefined
            }
            placeholder={
              selectedType === "EXPENSE"
                ? "Ex.: Supermercado, Aluguel, Conta de luz"
                : "Ex.: Salário, Projeto freelance"
            }
            {...form.register("description", {
              onBlur: () => {
                void trySuggestOnBlur();
              },
            })}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.description?.message && (
            <p
              id="tx-description-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Valor e Data */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tx-amount"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
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
                aria-invalid={Boolean(errors.amount) || undefined}
                aria-describedby={errors.amount ? "tx-amount-error" : undefined}
                {...form.register("amount")}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {errors.amount?.message && (
              <p
                id="tx-amount-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.amount.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tx-date"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Data
            </label>
            <input
              id="tx-date"
              type="date"
              aria-invalid={Boolean(errors.date) || undefined}
              aria-describedby={errors.date ? "tx-date-error" : undefined}
              {...form.register("date")}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {errors.date?.message && (
              <p
                id="tx-date-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.date.message}
              </p>
            )}
          </div>
        </div>

        {/* Conta e Categoria */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tx-wallet"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Conta
            </label>
            <select
              id="tx-wallet"
              aria-invalid={Boolean(errors.walletId) || undefined}
              aria-describedby={errors.walletId ? "tx-wallet-error" : undefined}
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
                id="tx-wallet-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.walletId.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tx-category"
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
                id="tx-category"
                aria-invalid={Boolean(errors.categoryId) || undefined}
                aria-describedby={
                  errors.categoryId ? "tx-category-error" : undefined
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
            {errors.categoryId?.message ? (
              <p
                id="tx-category-error"
                className="mt-1 text-xs font-medium text-rose-600"
              >
                {errors.categoryId.message}
              </p>
            ) : (
              suggestedCatId &&
              watchedCategoryId === suggestedCatId && (
                <p className="mt-1 text-xs font-medium text-violet-600">
                  Categoria sugerida automaticamente pelas suas regras.
                </p>
              )
            )}
          </div>
        </div>

        {/* Status (Pago/Pendente ou Recebido/A receber conforme o tipo) */}
        <div>
          <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Situação
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {TRANSACTION_STATUSES.map((st) => {
              const active = selectedStatus === st;
              return (
                <button
                  key={st}
                  id={`tx-status-${st}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    form.setValue("status", st, { shouldDirty: true })
                  }
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
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
            <p
              id="tx-status-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.status.message}
            </p>
          )}
        </div>

        {/* Observações */}
        <div>
          <label
            htmlFor="tx-notes"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Observações{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="tx-notes"
            rows={2}
            aria-invalid={Boolean(errors.notes) || undefined}
            aria-describedby={errors.notes ? "tx-notes-error" : undefined}
            placeholder="Detalhes adicionais, parcela, forma de pagamento..."
            {...form.register("notes")}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition motion-reduce:transition-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {errors.notes?.message && (
            <p
              id="tx-notes-error"
              className="mt-1 text-xs font-medium text-rose-600"
            >
              {errors.notes.message}
            </p>
          )}
        </div>

        {/* Comprovante */}
        <div>
          <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Comprovante{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </span>
          <input
            ref={fileInputRef}
            id="tx-attachment"
            type="file"
            accept={ATTACHMENT_ACCEPT}
            onChange={handleFileChosen}
            className="sr-only"
            aria-describedby="tx-attachment-hint"
          />
          {file || atual ? (
            <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {file ? file.name : atual?.fileName}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {formatBytes(file ? file.size : (atual?.sizeBytes ?? 0))}
                  {file ? " · será enviado ao salvar" : ""}
                </span>
              </span>
              {!file && editingTransaction && (
                <a
                  href={`/api/comprovantes/${editingTransaction.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300"
                >
                  Ver
                </a>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300"
              >
                Trocar
              </button>
              <button
                type="button"
                aria-label="Remover comprovante"
                onClick={() => {
                  setFile(null);
                  if (editingTransaction?.attachment) setRemoveAttachment(true);
                }}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-rose-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-rose-400"
              >
                Remover
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition motion-reduce:transition-none hover:border-violet-400 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {removeAttachment ? "Anexar outro comprovante" : "Anexar foto ou PDF"}
            </button>
          )}
          <p id="tx-attachment-hint" className={`mt-1 text-xs ${fileError ? "font-medium text-rose-600" : "text-slate-500 dark:text-slate-400"}`}>
            {fileError ?? (removeAttachment ? "O comprovante atual será removido ao salvar." : `Foto do recibo ou PDF, até ${formatBytes(ATTACHMENT_MAX_BYTES)}.`)}
          </p>
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
            disabled={isSubmitting || filteredCategories.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
