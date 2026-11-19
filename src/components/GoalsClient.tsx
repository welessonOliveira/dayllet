"use client";

import type { Goal, GoalContribution } from "@prisma/client";
import { useState } from "react";
import { formatDate, toDateInput } from "@/lib/dates";
import type { GoalProgress } from "@/lib/goals";
import { formatBRL } from "@/lib/money";
import {
  deleteGoalAction,
  deleteGoalContributionAction,
  setGoalArchivedAction,
} from "@/server/actions/goals";
import { ConfirmDialog } from "./ConfirmDialog";
import { GoalContributionModal } from "./GoalContributionModal";
import { GoalFormModal } from "./GoalFormModal";
import { useToast } from "./Toast";

export type GoalDetailItem = Goal & {
  progress: GoalProgress;
  contributions: GoalContribution[];
};

type GoalsClientProps = {
  goals: GoalDetailItem[];
};

function formatMmYyyy(d: Date): string {
  const [y, m] = toDateInput(new Date(d)).split("-");
  return `${m}/${y}`;
}

export function GoalsClient({ goals }: GoalsClientProps) {
  const toast = useToast();

  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [contribTarget, setContribTarget] = useState<{
    goal: GoalDetailItem;
    kind: "DEPOSIT" | "WITHDRAW";
  } | null>(null);

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [deletingGoal, setDeletingGoal] = useState<GoalDetailItem | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);

  const [deletingContrib, setDeletingContrib] = useState<{
    contrib: GoalContribution;
    goalName: string;
  } | null>(null);
  const [isDeletingContrib, setIsDeletingContrib] = useState(false);

  const archivedCount = goals.filter((g) => g.archived).length;
  const visibleGoals = showArchived
    ? goals
    : goals.filter((g) => !g.archived);

  async function handleToggleArchive(g: GoalDetailItem) {
    setArchivingId(g.id);
    try {
      const result = await setGoalArchivedAction(g.id, !g.archived);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    } finally {
      setArchivingId(null);
    }
  }

  async function handleConfirmDeleteGoal() {
    if (!deletingGoal) return;
    setIsDeletingGoal(true);
    try {
      const result = await deleteGoalAction(deletingGoal.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletingGoal(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeletingGoal(false);
    }
  }

  async function handleConfirmDeleteContrib() {
    if (!deletingContrib) return;
    setIsDeletingContrib(true);
    try {
      const result = await deleteGoalContributionAction(
        deletingContrib.contrib.id,
      );
      if (result.ok) {
        toast.success(result.message);
        setDeletingContrib(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsDeletingContrib(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            Metas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Planeje seus objetivos, guarde aos poucos e veja quanto falta por
            mês
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {archivedCount > 0 && (
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className={`inline-flex min-h-11 items-center rounded-2xl border px-3.5 py-2 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                showArchived
                  ? "border-violet-300 bg-violet-50 text-violet-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {showArchived
                ? "Ocultar arquivadas"
                : `Mostrar arquivadas (${archivedCount})`}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingGoal(null);
              setFormOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span>Nova meta</span>
          </button>
        </div>
      </div>

      {/* Lista de metas */}
      {visibleGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:bg-slate-900 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
            Nenhuma meta ativa no momento
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Crie uma meta como Reserva de emergência ou Viagem para acompanhar
            cada depósito até chegar lá.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingGoal(null);
              setFormOpen(true);
            }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {visibleGoals.map((g) => {
            const { progress } = g;
            const color = g.color || "#a67c52";
            const historyOpen = expandedHistoryId === g.id;
            const isArchiving = archivingId === g.id;

            return (
              <article
                key={g.id}
                className={`flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-xs transition motion-reduce:transition-none ${
                  g.archived
                    ? "border-slate-200/70 opacity-80"
                    : progress.done
                      ? "border-emerald-200"
                      : progress.overdue
                        ? "border-rose-200"
                        : "border-slate-200/80"
                }`}
              >
                <div>
                  {/* Topo: cor, nome e selos */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      >
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                            {g.name}
                          </h2>
                          {g.archived && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              Arquivada
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {g.targetDate
                            ? `Prazo: ${formatDate(new Date(g.targetDate))}`
                            : "Sem prazo definido"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${
                        progress.done
                          ? "bg-emerald-100 text-emerald-800"
                          : progress.overdue
                            ? "bg-rose-100 text-rose-800"
                            : "bg-violet-100 text-violet-800"
                      }`}
                    >
                      {progress.percent}%
                    </span>
                  </div>

                  {/* Valores R$ X de R$ Y + barra de progresso */}
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatBRL(progress.savedCents)}{" "}
                        <span className="font-normal text-slate-500">
                          de {formatBRL(progress.targetCents)}
                        </span>
                      </span>
                      {!progress.done && progress.remainingCents > 0 && (
                        <span className="text-xs font-semibold text-slate-600">
                          Faltam {formatBRL(progress.remainingCents)}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all motion-reduce:transition-none"
                        style={{
                          width: `${progress.percentBar}%`,
                          backgroundColor: progress.done
                            ? "#059669"
                            : progress.overdue
                              ? "#e11d48"
                              : color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Mensagem de prazo / ritmo mensal */}
                  <div className="mt-3">
                    {progress.done ? (
                      <p className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                        Meta batida!
                      </p>
                    ) : progress.overdue ? (
                      <p className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                        Prazo vencido
                      </p>
                    ) : g.targetDate &&
                      progress.monthlyNeededCents !== null ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        Guarde{" "}
                        <strong className="font-bold text-violet-700">
                          {formatBRL(progress.monthlyNeededCents)}
                        </strong>{" "}
                        por mês até{" "}
                        <strong>{formatMmYyyy(g.targetDate)}</strong>
                      </p>
                    ) : null}
                  </div>

                  {/* Botões rápidos Guardar / Retirar */}
                  {!g.archived && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setContribTarget({ goal: g, kind: "DEPOSIT" })
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                      >
                        + Guardar
                      </button>
                      <button
                        type="button"
                        disabled={progress.savedCents <= 0}
                        onClick={() =>
                          setContribTarget({ goal: g, kind: "WITHDRAW" })
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        − Retirar
                      </button>
                    </div>
                  )}

                  {/* Histórico de movimentações expansível */}
                  {historyOpen && (
                    <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Histórico de movimentações
                      </h3>
                      {g.contributions.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Nenhuma movimentação registrada ainda.
                        </p>
                      ) : (
                        <ul className="mt-2 divide-y divide-slate-200/70">
                          {g.contributions.map((c) => {
                            const isDeposit = c.amountCents > 0;
                            return (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-2 py-2 text-xs first:pt-0 last:pb-0"
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                    {formatDate(new Date(c.date))}
                                  </span>
                                  {c.note && (
                                    <span className="ml-1.5 text-slate-500">
                                      · {c.note}
                                    </span>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span
                                    className={`font-bold tabular-nums ${
                                      isDeposit
                                        ? "text-emerald-600"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    {isDeposit ? "+ " : "- "}
                                    {formatBRL(Math.abs(c.amountCents))}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeletingContrib({
                                        contrib: c,
                                        goalName: g.name,
                                      })
                                    }
                                    aria-label="Apagar movimentação"
                                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                  >
                                    Apagar
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé de gerenciamento */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    aria-expanded={historyOpen}
                    onClick={() =>
                      setExpandedHistoryId(historyOpen ? null : g.id)
                    }
                    className="-ml-2 inline-flex min-h-11 items-center rounded-xl px-2.5 text-xs font-semibold text-violet-600 transition motion-reduce:transition-none hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9"
                  >
                    {historyOpen
                      ? "Ocultar histórico"
                      : `Histórico (${g.contributions.length})`}
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isArchiving}
                      onClick={() => handleToggleArchive(g)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 md:min-h-9 md:border-transparent md:bg-transparent md:py-1.5 md:text-slate-600"
                    >
                      {g.archived ? "Reativar" : "Arquivar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGoal(g);
                        setFormOpen(true);
                      }}
                      aria-label={`Editar meta ${g.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition motion-reduce:transition-none hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-0 md:border-transparent md:bg-transparent md:px-2.5 md:py-1.5 md:text-slate-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingGoal(g)}
                      aria-label={`Excluir meta ${g.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 transition motion-reduce:transition-none hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-0 md:border-transparent md:bg-transparent md:px-2.5 md:py-1.5 md:text-rose-600 md:hover:bg-rose-50"
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

      {/* Modal criar / editar meta */}
      <GoalFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingGoal(null);
        }}
        editingGoal={editingGoal}
      />

      {/* Modal guardar / retirar */}
      <GoalContributionModal
        open={Boolean(contribTarget)}
        onClose={() => setContribTarget(null)}
        goal={
          contribTarget
            ? {
                id: contribTarget.goal.id,
                name: contribTarget.goal.name,
                savedCents: contribTarget.goal.progress.savedCents,
              }
            : null
        }
        defaultKind={contribTarget?.kind}
      />

      {/* Confirmação de exclusão de meta */}
      <ConfirmDialog
        open={Boolean(deletingGoal)}
        onClose={() => setDeletingGoal(null)}
        onConfirm={handleConfirmDeleteGoal}
        loading={isDeletingGoal}
        title="Excluir esta meta?"
        description={
          deletingGoal ? (
            <>
              Deseja excluir permanentemente a meta{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {deletingGoal.name}
              </strong>
              ?
            </>
          ) : null
        }
        warningTone="red"
        warning={
          deletingGoal ? (
            <p>
              <strong>Atenção:</strong> todo o histórico de movimentações desta
              meta ({deletingGoal.contributions.length}{" "}
              {deletingGoal.contributions.length === 1 ? "registro" : "registros"}
              ) será apagado junto com ela. Se quiser apenas tirá-la da tela,
              use a opção Arquivar.
            </p>
          ) : undefined
        }
        confirmLabel="Sim, excluir meta e histórico"
      />

      {/* Confirmação de exclusão de movimentação */}
      <ConfirmDialog
        open={Boolean(deletingContrib)}
        onClose={() => setDeletingContrib(null)}
        onConfirm={handleConfirmDeleteContrib}
        loading={isDeletingContrib}
        title="Apagar movimentação?"
        description={
          deletingContrib ? (
            <>
              Deseja apagar esta movimentação de{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatBRL(Math.abs(deletingContrib.contrib.amountCents))}
              </strong>{" "}
              na meta <strong>{deletingContrib.goalName}</strong>?
            </>
          ) : null
        }
        confirmLabel="Sim, apagar movimentação"
      />
    </div>
  );
}
