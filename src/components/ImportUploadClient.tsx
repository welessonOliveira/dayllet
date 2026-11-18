"use client";

import type { Wallet } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { WALLET_KIND_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import {
  createImportAction,
  undoImportAction,
} from "@/server/actions/imports";
import type { listImports } from "@/server/imports";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

type ImportBatchItem = Awaited<ReturnType<typeof listImports>>[number];

type ImportUploadClientProps = {
  wallets: Wallet[];
  batches: ImportBatchItem[];
};

export function ImportUploadClient({
  wallets,
  batches,
}: ImportUploadClientProps) {
  const router = useRouter();
  const toast = useToast();

  const defaultWalletId =
    wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "";

  const [walletId, setWalletId] = useState(defaultWalletId);
  const [isUploading, setIsUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  const [undoingBatch, setUndoingBatch] = useState<ImportBatchItem | null>(
    null,
  );
  const [isUndoing, setIsUndoing] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const formData = new FormData(e.currentTarget);

    setIsUploading(true);
    try {
      const result = await createImportAction(formData);
      if (result.ok) {
        toast.success(result.message);
        if (result.data.errors.length > 0) {
          try {
            window.sessionStorage.setItem(
              `import-warnings:${result.data.batchId}`,
              JSON.stringify(result.data.errors),
            );
          } catch {
            // sessionStorage indisponível
          }
        }
        router.push(`/importar/${result.data.batchId}`);
        return;
      }

      setServerError(result.error);
      toast.error(result.error);
      window.requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleConfirmUndo() {
    if (!undoingBatch) return;
    setIsUndoing(true);
    try {
      const result = await undoImportAction(undoingBatch.id);
      if (result.ok) {
        toast.success(result.message);
        setUndoingBatch(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          Importar extrato
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Envie um arquivo OFX ou CSV para revisar, categorizar automaticamente
          e confirmar os lançamentos
        </p>
      </div>

      {/* Formulário de upload */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Novo arquivo de extrato
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nada entra nas suas contas antes da sua revisão na próxima etapa
              (formatos .ofx ou .csv até 1 MB).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="/exemplos/extrato-exemplo.ofx"
              download
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 font-semibold text-violet-700 transition motion-reduce:transition-none hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:py-1.5"
            >
              Baixar extrato de exemplo (.OFX)
            </a>
            <a
              href="/exemplos/extrato-exemplo.csv"
              download
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:py-1.5"
            >
              Baixar exemplo (.CSV)
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="imp-wallet"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Conta de destino
              </label>
              <select
                id="imp-wallet"
                name="walletId"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
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
            </div>

            <div>
              <label
                htmlFor="imp-file"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Arquivo do extrato (.ofx ou .csv)
              </label>
              <input
                id="imp-file"
                name="file"
                type="file"
                accept=".ofx,.csv,.txt"
                required
                className="mt-1.5 block min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isUploading || wallets.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? "Lendo extrato..."
                : "Enviar e revisar lançamentos"}
            </button>
          </div>
        </form>
      </section>

      {/* Histórico de importações */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Histórico de importações
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lotes pendentes de revisão e importações já confirmadas
          </p>
        </div>

        {batches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 px-6 py-10 text-center dark:bg-slate-800/40">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhuma importação realizada ainda
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Baixe um dos extratos de exemplo acima para testar o fluxo de
              revisão e categorização automática.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {batches.map((b) => {
              const inReview = b.status === "REVIEW";
              return (
                <li
                  key={b.id}
                  className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {b.fileName}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {b.format}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          inReview
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {inReview ? "Em revisão" : "Confirmada"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Conta: <strong>{b.wallet.name}</strong> ·{" "}
                      {formatDate(new Date(b.createdAt))} ·{" "}
                      {inReview
                        ? `${b.rowCount} linhas aguardando revisão`
                        : `${b.importedCount} de ${b.rowCount} lançamentos importados`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {inReview ? (
                      <Link
                        href={`/importar/${b.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9"
                      >
                        Revisar agora →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setUndoingBatch(b)}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 transition motion-reduce:transition-none hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 md:min-h-9 md:py-1.5"
                      >
                        Desfazer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Confirmação para desfazer importação */}
      <ConfirmDialog
        open={Boolean(undoingBatch)}
        onClose={() => setUndoingBatch(null)}
        onConfirm={handleConfirmUndo}
        loading={isUndoing}
        loadingLabel="Desfazendo..."
        title="Desfazer esta importação?"
        description={
          undoingBatch ? (
            <>
              Deseja desfazer a importação do arquivo{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {undoingBatch.fileName}
              </strong>{" "}
              na conta{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {undoingBatch.wallet.name}
              </strong>
              ?
            </>
          ) : null
        }
        warning={
          undoingBatch ? (
            <p>
              Os{" "}
              <strong>
                {undoingBatch.importedCount}{" "}
                {undoingBatch.importedCount === 1
                  ? "lançamento criado"
                  : "lançamentos criados"}
              </strong>{" "}
              por esta importação serão apagados do seu extrato.
            </p>
          ) : undefined
        }
        confirmLabel="Sim, desfazer importação"
      />
    </div>
  );
}
