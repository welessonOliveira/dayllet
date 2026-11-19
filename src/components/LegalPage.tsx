// Moldura simples das páginas públicas de texto (Privacidade e Termos).
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-10 md:py-16">
      <Link
        href="/login"
        className="text-sm font-semibold text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-400"
      >
        ← Voltar pro Dayllet
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Atualizado em {updated}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_li]:ml-5 [&_li]:list-disc [&_a]:font-semibold [&_a]:text-violet-700 dark:[&_a]:text-violet-400 [&_a:hover]:underline">
        {children}
      </div>
    </main>
  );
}
