"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { WALLET_KIND_LABEL, type WalletKind } from "@/lib/constants";
import { formatBRL } from "@/lib/money";
import {
  deleteWalletAction,
  setDefaultWalletAction,
} from "@/server/actions/wallets";
import type { WalletWithBalance } from "@/server/wallets";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { WalletFormModal } from "./WalletFormModal";

type WalletsClientProps = {
  wallets: WalletWithBalance[];
};

const KIND_ICON: Record<WalletKind, ReactNode> = {
  CHECKING: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </svg>
  ),
  SAVINGS: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  WALLET: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" />
      <path d="M16 12h5" />
    </svg>
  ),
};

export function WalletsClient({ wallets }: WalletsClientProps) {
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletWithBalance | null>(
    null,
  );
  const [deletingWallet, setDeletingWallet] =
    useState<WalletWithBalance | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  async function handleSetDefault(wallet: WalletWithBalance) {
    setSettingDefaultId(wallet.id);
    try {
      const result = await setDefaultWalletAction(wallet.id);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingWallet) return;
    setIsDeleting(true);
    try {
      const result = await deleteWalletAction(deletingWallet.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletingWallet(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  // Soma inteira em centavos dos saldos atuais e previstos
  let totalCurrentCents = 0;
  let totalProjectedCents = 0;
  for (const w of wallets) {
    totalCurrentCents += w.balance.currentCents;
    totalProjectedCents += w.balance.projectedCents;
  }

  const isOnlyWallet = wallets.length <= 1;
  const blockedByTransactions = Boolean(
    deletingWallet && deletingWallet.transactionCount > 0,
  );
  const confirmBlocked = Boolean(
    deletingWallet && (blockedByTransactions || isOnlyWallet),
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Contas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Saldos atuais e previstos das suas contas correntes, poupanças e
            carteiras
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingWallet(null);
            setFormOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:self-auto"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          <span>Nova conta</span>
        </button>
      </div>

      {/* Resumo consolidado das contas */}
      {wallets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-xs">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              Saldo total atual
            </span>
            <p
              className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums ${
                totalCurrentCents < 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {formatBRL(totalCurrentCents)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Soma do dinheiro disponível hoje em{" "}
              {wallets.length === 1 ? "1 conta" : `${wallets.length} contas`}{" "}
              (saldo inicial + recebido − pago).
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Saldo total previsto
            </span>
            <p
              className={`mt-3 text-3xl font-extrabold tracking-tight tabular-nums ${
                totalProjectedCents < 0 ? "text-rose-600" : "text-slate-700"
              }`}
            >
              {formatBRL(totalProjectedCents)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Projeção se todas as receitas a receber e despesas pendentes forem
              quitadas.
            </p>
          </div>
        </div>
      )}

      {/* Lista de contas */}
      {wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            {KIND_ICON.WALLET}
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Nenhuma conta cadastrada
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Adicione sua primeira conta corrente, poupança ou carteira para
            acompanhar seus saldos.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingWallet(null);
              setFormOpen(true);
            }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Criar conta
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {wallets.map((w) => {
            const isNegativeCurrent = w.balance.currentCents < 0;
            const isNegativeProjected = w.balance.projectedCents < 0;
            const isSettingDefault = settingDefaultId === w.id;

            return (
              <article
                key={w.id}
                className={`flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-xs transition motion-reduce:transition-none ${
                  w.isDefault
                    ? "border-violet-200 ring-1 ring-violet-100"
                    : "border-slate-200/80"
                }`}
              >
                <div>
                  {/* Topo: ícone, nome, tipo e selo Padrão */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          w.isDefault
                            ? "bg-violet-600 text-white"
                            : "bg-violet-50 text-violet-600"
                        }`}
                      >
                        {KIND_ICON[w.kind]}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-bold text-slate-900">
                            {w.name}
                          </h2>
                          {w.isDefault && (
                            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                              Padrão
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                          {WALLET_KIND_LABEL[w.kind]}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/transacoes?walletId=${w.id}`}
                      className="-my-1 -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-xl px-2 text-xs font-semibold text-slate-500 transition motion-reduce:transition-none hover:text-violet-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-8"
                    >
                      {w.transactionCount === 1
                        ? "1 lançamento →"
                        : `${w.transactionCount} lançamentos →`}
                    </Link>
                  </div>

                  {/* Saldo atual em destaque + Saldo previsto menor */}
                  <div className="mt-5 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60">
                    <div>
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Saldo atual
                      </span>
                      <span
                        className={`mt-0.5 block text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl ${
                          isNegativeCurrent ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {formatBRL(w.balance.currentCents)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-xs tabular-nums">
                      <div>
                        <span className="text-slate-500">Saldo previsto: </span>
                        <strong
                          className={`font-bold ${
                            isNegativeProjected
                              ? "text-rose-600"
                              : "text-slate-700"
                          }`}
                        >
                          {formatBRL(w.balance.projectedCents)}
                        </strong>
                      </div>
                      <span className="text-slate-400">
                        Inicial: {formatBRL(w.openingBalanceCents)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rodapé de ações */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div>
                    {!w.isDefault && (
                      <button
                        type="button"
                        disabled={isSettingDefault}
                        onClick={() => handleSetDefault(w)}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs font-semibold text-violet-700 transition motion-reduce:transition-none hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 md:min-h-9 md:py-1.5"
                      >
                        {isSettingDefault ? "Salvando..." : "Tornar padrão"}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWallet(w);
                        setFormOpen(true);
                      }}
                      aria-label={`Editar conta ${w.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 transition motion-reduce:transition-none hover:bg-slate-100 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-0 md:rounded-lg md:border-transparent md:bg-transparent md:px-2.5 md:py-1.5 md:text-slate-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingWallet(w)}
                      aria-label={`Excluir conta ${w.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700 transition motion-reduce:transition-none hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-0 md:rounded-lg md:border-transparent md:bg-transparent md:px-2.5 md:py-1.5 md:text-rose-600 md:hover:bg-rose-50"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal criar / editar conta */}
      <WalletFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingWallet(null);
        }}
        editingWallet={editingWallet}
      />

      {/* Confirmação de exclusão com avisos para lançamentos ou única conta */}
      <ConfirmDialog
        open={Boolean(deletingWallet)}
        onClose={() => setDeletingWallet(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        confirmDisabled={confirmBlocked}
        cancelLabel={confirmBlocked ? "Entendi" : "Cancelar"}
        confirmLabel="Sim, excluir conta"
        title={
          confirmBlocked
            ? "Não é possível excluir esta conta"
            : "Excluir conta?"
        }
        description={
          deletingWallet ? (
            blockedByTransactions ? (
              <>
                A conta{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingWallet.name}
                </strong>{" "}
                possui{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingWallet.transactionCount === 1
                    ? "1 lançamento vinculado"
                    : `${deletingWallet.transactionCount} lançamentos vinculados`}
                </strong>{" "}
                e não pode ser excluída.
              </>
            ) : isOnlyWallet ? (
              <>
                A conta{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingWallet.name}
                </strong>{" "}
                é a sua única conta cadastrada e não pode ser excluída.
              </>
            ) : (
              <>
                Tem certeza de que deseja excluir a conta{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingWallet.name}
                </strong>
                ? Essa ação não pode ser desfeita.
              </>
            )
          ) : null
        }
        warningTone={confirmBlocked ? "red" : "amber"}
        warning={
          deletingWallet ? (
            blockedByTransactions ? (
              <div className="space-y-2">
                <p>
                  Para excluir esta conta, mova ou exclua os lançamentos dela na
                  tela de Transações antes.
                </p>
                <Link
                  href={`/transacoes?walletId=${deletingWallet.id}`}
                  onClick={() => setDeletingWallet(null)}
                  className="-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline hover:text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
                >
                  Ver lançamentos desta conta →
                </Link>
              </div>
            ) : isOnlyWallet ? (
              <p>
                Você precisa ter pelo menos uma conta ativa. Crie outra conta
                antes caso deseje substituir esta.
              </p>
            ) : deletingWallet.isDefault ? (
              <p>
                <strong>Nota:</strong> como esta é sua conta padrão atual, outra
                conta passará a ser a padrão automaticamente após a exclusão.
              </p>
            ) : undefined
          ) : undefined
        }
      />
    </div>
  );
}
