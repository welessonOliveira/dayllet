"use client";

import type { Category, Wallet } from "@prisma/client";
import { useState } from "react";
import { CATEGORY_TYPE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import {
  deleteRecurringRuleAction,
  setRecurringRuleActiveAction,
} from "@/server/actions/recurring";
import type { RecurringRuleView } from "@/server/recurring";
import { ConfirmDialog } from "./ConfirmDialog";
import { RecurringFormModal } from "./RecurringFormModal";
import { useToast } from "./Toast";

type RecurringClientProps = {
  rules: RecurringRuleView[];
  categories: Category[];
  wallets: Wallet[];
};

export function RecurringClient({
  rules,
  categories,
  wallets,
}: RecurringClientProps) {
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRuleView | null>(
    null,
  );
  const [togglingRule, setTogglingRule] = useState<RecurringRuleView | null>(
    null,
  );
  const [isToggling, setIsToggling] = useState(false);
  const [deletingRule, setDeletingRule] = useState<RecurringRuleView | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmToggle() {
    if (!togglingRule) return;
    setIsToggling(true);
    try {
      const result = await setRecurringRuleActiveAction(
        togglingRule.id,
        !togglingRule.active,
      );
      if (result.ok) {
        toast.success(result.message);
        setTogglingRule(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsToggling(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingRule) return;
    setIsDeleting(true);
    try {
      const result = await deleteRecurringRuleAction(deletingRule.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletingRule(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Recorrentes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Contas fixas e compras parceladas que geram lançamentos
            automaticamente
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingRule(null);
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
          <span>Nova regra</span>
        </button>
      </div>

      {/* Lista de regras */}
      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Nenhuma conta fixa ou parcelamento cadastrado
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Cadastre despesas fixas como aluguel e internet ou compras
            parceladas para projetar seus próximos meses automaticamente.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingRule(null);
              setFormOpen(true);
            }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Criar conta fixa ou parcelado
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rules.map((r) => {
            const isIncome = r.type === "INCOME";
            const isInstallment = r.installments !== null;

            return (
              <article
                key={r.id}
                className={`flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-xs transition motion-reduce:transition-none ${
                  !r.active || r.finished
                    ? "border-slate-200/70 opacity-85"
                    : "border-slate-200/80"
                }`}
              >
                <div>
                  {/* Topo: descrição, selos e tipo */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                        style={{
                          backgroundColor: r.category.color || "#7c3aed",
                        }}
                        aria-hidden="true"
                      >
                        {r.category.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h2 className="truncate text-base font-bold text-slate-900">
                            {r.description}
                          </h2>
                          {!r.active && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Pausada
                            </span>
                          )}
                          {r.finished && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              Concluída
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{r.category.name}</span>
                          <span>·</span>
                          <span>{r.wallet.name}</span>
                          <span>·</span>
                          <span>{r.scheduleLabel}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {CATEGORY_TYPE_LABEL[r.type]}
                    </span>
                  </div>

                  {/* Próxima ocorrência e progresso de parcelas */}
                  <div className="mt-4 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60">
                    {r.nextDate && r.nextAmountCents !== null ? (
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Próxima ocorrência
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold text-slate-800 tabular-nums">
                            {formatDate(new Date(r.nextDate))}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Valor
                          </span>
                          <span
                            className={`mt-0.5 block text-xl font-extrabold tabular-nums ${
                              isIncome ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {formatBRL(r.nextAmountCents)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {!r.active
                            ? "Regra pausada (sem novas ocorrências)"
                            : "Todas as ocorrências já foram geradas"}
                        </span>
                        <strong className="font-bold text-slate-700 tabular-nums">
                          {isInstallment ? "Total: " : ""}
                          {formatBRL(r.amountCents)}
                        </strong>
                      </div>
                    )}

                    {isInstallment && r.paidInstallments !== null && (
                      <div className="mt-3 border-t border-slate-200/70 pt-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-violet-700 tabular-nums">
                            {r.paidInstallments} de {r.installments} pagas
                          </span>
                          <span className="text-slate-500 tabular-nums">
                            Total: {formatBRL(r.amountCents)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className="h-full rounded-full bg-violet-600 transition-all motion-reduce:transition-none"
                            style={{
                              width: `${Math.min(
                                Math.round(
                                  (r.paidInstallments * 100) /
                                    (r.installments ?? 1),
                                ),
                                100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div>
                    {!r.finished && (
                      <button
                        type="button"
                        onClick={() => setTogglingRule(r)}
                        className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:py-1.5 ${
                          r.active
                            ? "border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {r.active ? "Pausar" : "Retomar"}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRule(r);
                        setFormOpen(true);
                      }}
                      aria-label={`Editar ${r.description}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 transition motion-reduce:transition-none hover:bg-slate-100 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-0 md:rounded-lg md:border-transparent md:bg-transparent md:px-2.5 md:py-1.5 md:text-slate-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRule(r)}
                      aria-label={`Excluir ${r.description}`}
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

      {/* Modal criar / editar */}
      <RecurringFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingRule(null);
        }}
        categories={categories}
        wallets={wallets}
        editingRule={editingRule}
      />

      {/* Confirmação de Pausar / Retomar */}
      <ConfirmDialog
        open={Boolean(togglingRule)}
        onClose={() => setTogglingRule(null)}
        onConfirm={handleConfirmToggle}
        loading={isToggling}
        confirmTone="primary"
        title={
          togglingRule?.active
            ? "Pausar esta regra?"
            : "Retomar esta regra?"
        }
        description={
          togglingRule ? (
            togglingRule.active ? (
              <>
                Deseja pausar{" "}
                <strong className="font-semibold text-slate-900">
                  {togglingRule.description}
                </strong>
                ? Isso vale só daqui pra frente: as ocorrências futuras ainda
                pendentes serão removidas, e o histórico já registrado fica
                mantido.
              </>
            ) : (
              <>
                Deseja retomar{" "}
                <strong className="font-semibold text-slate-900">
                  {togglingRule.description}
                </strong>
                ? Isso vale só daqui pra frente e voltará a gerar as próximas
                ocorrências pendentes.
              </>
            )
          ) : null
        }
        confirmLabel={
          togglingRule?.active ? "Sim, pausar regra" : "Sim, retomar regra"
        }
      />

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={Boolean(deletingRule)}
        onClose={() => setDeletingRule(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Excluir regra recorrente?"
        description={
          deletingRule ? (
            <>
              Deseja excluir{" "}
              <strong className="font-semibold text-slate-900">
                {deletingRule.description}
              </strong>
              ?
            </>
          ) : null
        }
        warning={
          <p>
            <strong>O histórico fica:</strong> a exclusão vale só daqui pra
            frente. Os lançamentos passados ou já pagos continuam no extrato e
            apenas as ocorrências futuras pendentes serão apagadas.
          </p>
        }
        confirmLabel="Sim, excluir regra"
      />
    </div>
  );
}
