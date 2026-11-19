"use client";

import type { Category, Wallet } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import {
  commitImportAction,
  discardImportAction,
  updateImportRowAction,
} from "@/server/actions/imports";
import type { ImportView } from "@/server/imports";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

type ImportReviewClientProps = {
  batch: ImportView;
  categories: Category[];
  /** Contas do usuário: a linha pode virar transferência com uma delas. */
  wallets?: Wallet[];
};

export function ImportReviewClient({
  batch,
  categories,
  wallets = [],
}: ImportReviewClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [warnings, setWarnings] = useState<string[]>([]);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  // A revisão vai esvaziando: quem ganha categoria (ou é pulado) sai da aba "A revisar".
  const [aba, setAba] = useState<"revisar" | "prontos" | "pulados">("revisar");

  useEffect(() => {
    try {
      const key = `import-warnings:${batch.id}`;
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWarnings(parsed);
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // ignora erro de leitura
    }
  }, [batch.id]);

  if (batch.status !== "REVIEW") {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {batch.status === "COMMITTED"
              ? "Esta importação já foi confirmada"
              : "Esta importação foi descartada"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Arquivo <strong>{batch.fileName}</strong> na conta{" "}
            <strong>{batch.wallet.name}</strong>.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/importar"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Voltar para Importar
            </Link>
            <Link
              href={`/transacoes?walletId=${batch.walletId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Ver extrato da conta →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = batch;
  const outrasContas = wallets.filter((w) => w.id !== batch.walletId);
  /** Valor do select -> mudança: "w:<id>" vira transferência; o resto é categoria. */
  function escolhaDoSelect(v: string): { categoryId?: string | null; transferWalletId?: string | null } {
    return v.startsWith("w:") ? { transferWalletId: v.slice(2) } : { categoryId: v || null };
  }
  const linhasVisiveis = batch.rows.filter((r) =>
    aba === "revisar"
      ? r.decision === "IMPORT" && !r.categoryId && !r.transferWalletId
      : aba === "prontos"
        ? r.decision === "IMPORT" && Boolean(r.categoryId || r.transferWalletId)
        : r.decision === "SKIP",
  );
  const canCommit =
    summary.toImport > 0 && summary.withoutCategory === 0 && !isCommitting;

  async function handleRowChange(
    rowId: string,
    change: { decision?: "IMPORT" | "SKIP"; categoryId?: string | null; transferWalletId?: string | null },
  ) {
    setUpdatingRowId(rowId);
    try {
      const result = await updateImportRowAction(rowId, change);
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.data.similarUpdated > 0) {
        const n = result.data.similarUpdated;
        toast.success(`Aplicado também em ${n} ${n === 1 ? "lançamento parecido" : "lançamentos parecidos"}.`);
      }
    } finally {
      setUpdatingRowId(null);
    }
  }

  async function handleCommit() {
    setIsCommitting(true);
    try {
      const result = await commitImportAction(batch.id);
      if (result.ok) {
        toast.success(
          `${result.message} (${result.data.imported} importados, ${result.data.skipped} pulados).`,
        );
        router.push("/importar");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleConfirmDiscard() {
    setIsDiscarding(true);
    try {
      const result = await discardImportAction(batch.id);
      if (result.ok) {
        toast.success(result.message);
        setDiscardOpen(false);
        router.push("/importar");
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDiscarding(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho + botões principais */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/importar"
            className="-ml-2 inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            ← Voltar para Importar
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            Revisar extrato
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Arquivo <strong className="text-slate-700">{batch.fileName}</strong>{" "}
            ({batch.format}) · Conta{" "}
            <strong className="text-slate-700">{batch.wallet.name}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isCommitting || isDiscarding}
            onClick={() => setDiscardOpen(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition motion-reduce:transition-none hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={!canCommit}
            onClick={handleCommit}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isCommitting ? "Confirmando..." : "Confirmar importação"}
          </button>
        </div>
      </div>

      {/* Avisos de linhas ignoradas na leitura, se houver */}
      {warnings.length > 0 && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
        >
          <p className="font-bold text-amber-950">
            Avisos na leitura do arquivo:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Resumo dos contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Total lido
          </span>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {summary.total}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            A importar
          </span>
          <p className="mt-1 text-xl font-bold text-violet-800 tabular-nums">
            {summary.toImport}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Já importados
          </span>
          <p className="mt-1 text-xl font-bold text-slate-700 tabular-nums">
            {summary.duplicates}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Possíveis dup.
          </span>
          <p className="mt-1 text-xl font-bold text-amber-700 tabular-nums">
            {summary.possibleDuplicates}
          </p>
        </div>

        <div
          className={`col-span-2 rounded-2xl border p-4 shadow-xs sm:col-span-1 ${
            summary.withoutCategory > 0
              ? "border-rose-200 bg-rose-50/70"
              : "border-emerald-200 bg-emerald-50/50"
          }`}
        >
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide ${
              summary.withoutCategory > 0 ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            Sem categoria
          </span>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              summary.withoutCategory > 0 ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {summary.withoutCategory}
          </p>
        </div>
      </div>

      {summary.withoutCategory > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs font-medium text-amber-950"
        >
          Escolha uma categoria para{" "}
          <strong>
            {summary.withoutCategory}{" "}
            {summary.withoutCategory === 1
              ? "lançamento marcado"
              : "lançamentos marcados"}
          </strong>{" "}
          como Importar (ou mude para Pular) para liberar a confirmação.
        </div>
      )}

      {/* Abas: a lista vai esvaziando conforme as linhas ganham categoria */}
      {(() => {
        const contagem = {
          revisar: batch.rows.filter((r) => r.decision === "IMPORT" && !r.categoryId && !r.transferWalletId).length,
          prontos: batch.rows.filter((r) => r.decision === "IMPORT" && (r.categoryId || r.transferWalletId)).length,
          pulados: batch.rows.filter((r) => r.decision === "SKIP").length,
        };
        const abas = [
          { id: "revisar" as const, label: "A revisar" },
          { id: "prontos" as const, label: "Prontos" },
          { id: "pulados" as const, label: "Pulados" },
        ];
        return (
          <div role="tablist" aria-label="Filtrar linhas da importação" className="flex flex-wrap gap-2">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 ${
                  aba === a.id
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {a.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    aba === a.id ? "bg-white/20" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {contagem[a.id]}
                </span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Lista de linhas em revisão */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {linhasVisiveis.length === 0 && (
          <p className="px-5 py-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
            {aba === "revisar"
              ? "Tudo categorizado! Confira em Prontos e confirme a importação."
              : aba === "prontos"
                ? "Nenhuma linha pronta ainda. Escolha as categorias em A revisar."
                : "Nenhuma linha pulada."}
          </p>
        )}

        {/* Tabela Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3.5">Data</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5 text-right">Valor</th>
                <th className="px-4 py-3.5">Categoria</th>
                <th className="px-5 py-3.5 text-right">Decisão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {linhasVisiveis.map((row) => {
                const isIncome = row.type === "INCOME";
                const willImport = row.decision === "IMPORT";
                const isBusy = updatingRowId === row.id;
                const rowCats = categories.filter((c) => c.type === row.type);
                const isSuggested = Boolean(
                  row.categoryId &&
                    row.suggestedCategoryId &&
                    row.categoryId === row.suggestedCategoryId,
                );
                const needsCategory = willImport && !row.categoryId && !row.transferWalletId;

                return (
                  <tr
                    key={row.id}
                    className={`transition motion-reduce:transition-none ${
                      !willImport ? "bg-slate-50/60 opacity-65" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDate(new Date(row.date))}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {row.duplicateOfId && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            Já importado
                          </span>
                        )}
                        {row.possibleDuplicate && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Possível duplicata
                          </span>
                        )}
                        {row.note && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                            {row.note}
                          </span>
                        )}
                        {isSuggested && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            Sugerida
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3.5 text-right font-bold tabular-nums ${
                        isIncome ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {isIncome ? "+ " : "- "}
                      {formatBRL(row.amountCents)}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        aria-label={`Categoria de ${row.description}`}
                        disabled={isBusy}
                        value={row.transferWalletId ? `w:${row.transferWalletId}` : (row.categoryId ?? "")}
                        onChange={(e) =>
                          handleRowChange(row.id, escolhaDoSelect(e.target.value))
                        }
                        className={`min-h-10 w-full min-w-[180px] rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none transition motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 ${
                          needsCategory
                            ? "border-rose-300 bg-rose-50/40"
                            : "border-slate-200"
                        }`}
                      >
                        <option value="">Escolha uma categoria...</option>
                        {rowCats.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                            {cat.id === row.suggestedCategoryId
                              ? " (sugerida)"
                              : ""}
                          </option>
                        ))}
                        {outrasContas.length > 0 && (
                          <optgroup label="É transferência entre minhas contas">
                            {outrasContas.map((w) => (
                              <option key={w.id} value={`w:${w.id}`}>
                                {row.type === "EXPENSE" ? "Foi para" : "Veio de"}: {w.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-pressed={willImport}
                          onClick={() =>
                            !willImport &&
                            handleRowChange(row.id, { decision: "IMPORT" })
                          }
                          className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            willImport
                              ? "bg-violet-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100"
                          }`}
                        >
                          Importar
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-pressed={!willImport}
                          onClick={() =>
                            willImport &&
                            handleRowChange(row.id, { decision: "SKIP" })
                          }
                          className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            !willImport
                              ? "bg-white text-slate-800 shadow-xs"
                              : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100"
                          }`}
                        >
                          Pular
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lista Mobile (cards empilhados com alvos >= 44px) */}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {linhasVisiveis.map((row) => {
            const isIncome = row.type === "INCOME";
            const willImport = row.decision === "IMPORT";
            const isBusy = updatingRowId === row.id;
            const rowCats = categories.filter((c) => c.type === row.type);
            const isSuggested = Boolean(
              row.categoryId &&
                row.suggestedCategoryId &&
                row.categoryId === row.suggestedCategoryId,
            );
            const needsCategory = willImport && !row.categoryId && !row.transferWalletId;

            return (
              <li
                key={row.id}
                className={`space-y-3 p-4 ${!willImport ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.description}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDate(new Date(row.date))}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {row.duplicateOfId && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          Já importado
                        </span>
                      )}
                      {row.possibleDuplicate && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Possível duplicata
                        </span>
                      )}
                      {row.note && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                          {row.note}
                        </span>
                      )}
                      {isSuggested && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          Sugerida
                        </span>
                      )}
                    </div>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      isIncome ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {isIncome ? "+ " : "- "}
                    {formatBRL(row.amountCents)}
                  </p>
                </div>

                <select
                  aria-label={`Categoria de ${row.description}`}
                  disabled={isBusy}
                  value={row.transferWalletId ? `w:${row.transferWalletId}` : (row.categoryId ?? "")}
                  onChange={(e) =>
                    handleRowChange(row.id, escolhaDoSelect(e.target.value))
                  }
                  className={`min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    needsCategory
                      ? "border-rose-300 bg-rose-50/40"
                      : "border-slate-200"
                  }`}
                >
                  <option value="">Escolha uma categoria...</option>
                  {rowCats.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                      {cat.id === row.suggestedCategoryId ? " (sugerida)" : ""}
                    </option>
                  ))}
                  {outrasContas.length > 0 && (
                    <optgroup label="É transferência entre minhas contas">
                      {outrasContas.map((w) => (
                        <option key={w.id} value={`w:${w.id}`}>
                          {row.type === "EXPENSE" ? "Foi para" : "Veio de"}: {w.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-pressed={willImport}
                    onClick={() =>
                      !willImport &&
                      handleRowChange(row.id, { decision: "IMPORT" })
                    }
                    className={`min-h-11 rounded-xl text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      willImport
                        ? "bg-violet-600 text-white shadow-xs"
                        : "text-slate-600"
                    }`}
                  >
                    Importar
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-pressed={!willImport}
                    onClick={() =>
                      willImport &&
                      handleRowChange(row.id, { decision: "SKIP" })
                    }
                    className={`min-h-11 rounded-xl text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      !willImport
                        ? "bg-white text-slate-800 shadow-xs"
                        : "text-slate-600"
                    }`}
                  >
                    Pular
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Confirmação de descarte */}
      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={handleConfirmDiscard}
        loading={isDiscarding}
        loadingLabel="Descartando..."
        title="Descartar esta importação?"
        description={
          <>
            Deseja descartar a revisão do arquivo{" "}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {batch.fileName}
            </strong>
            ? Nenhum lançamento será gravado na conta {batch.wallet.name}.
          </>
        }
        confirmLabel="Sim, descartar"
      />
    </div>
  );
}
