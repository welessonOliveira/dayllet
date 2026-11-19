"use client";

import type { Category, CategoryRule } from "@prisma/client";
import { useState } from "react";
import { CATEGORY_TYPE_LABEL } from "@/lib/constants";
import { deleteCategoryRuleAction } from "@/server/actions/imports";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

type RuleWithCategory = CategoryRule & { category: Category };

type LearnedRulesSectionProps = {
  rules: RuleWithCategory[];
};

export function LearnedRulesSection({ rules }: LearnedRulesSectionProps) {
  const toast = useToast();
  const [deletingRule, setDeletingRule] = useState<RuleWithCategory | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deletingRule) return;
    setIsDeleting(true);
    try {
      const result = await deleteCategoryRuleAction(deletingRule.id);
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
    <section
      aria-labelledby="learned-rules-heading"
      className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs"
    >
      <div className="mb-4">
        <h2
          id="learned-rules-heading"
          className="text-base font-bold text-slate-900 dark:text-slate-100"
        >
          Regras aprendidas ({rules.length})
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Padrões na descrição aprendidos automaticamente para sugerir
          categorias em novos lançamentos e na importação de extratos
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 px-6 py-8 text-center dark:bg-slate-800/40">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Nenhuma regra aprendida ainda
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ao cadastrar transações ou confirmar uma importação de extrato, o
            app aprende suas escolhas automaticamente.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800">
                  {rule.pattern}
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  →
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: rule.category.color || "#a67c52",
                    }}
                  />
                  {rule.category.name} ({CATEGORY_TYPE_LABEL[rule.category.type]}
                  )
                </span>
                <span className="text-xs text-slate-400 tabular-nums">
                  · usada {rule.hits === 1 ? "1 vez" : `${rule.hits} vezes`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setDeletingRule(rule)}
                aria-label={`Apagar regra ${rule.pattern}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 transition motion-reduce:transition-none hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-0 md:rounded-lg md:border-transparent md:bg-transparent md:px-2.5 md:py-1.5 md:text-rose-600 md:hover:bg-rose-50"
              >
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deletingRule)}
        onClose={() => setDeletingRule(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Apagar regra aprendida?"
        description={
          deletingRule ? (
            <>
              Deseja apagar a regra automática{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {deletingRule.pattern}
              </strong>{" "}
              →{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {deletingRule.category.name}
              </strong>
              ? Os lançamentos já cadastrados não serão alterados.
            </>
          ) : null
        }
        confirmLabel="Sim, apagar regra"
      />
    </section>
  );
}
