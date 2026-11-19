// Card "Dicas do mês" do Início (dados de getInsights).
import Link from "next/link";
import type { Insight } from "@/server/insights";

const TOM = {
  warning: {
    box: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
    icon: <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  },
  good: {
    box: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
    icon: <path d="m5 13 4 4L19 7" />,
  },
  info: {
    box: "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
} as const;

export function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Dicas do mês</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">O que merece sua atenção agora</p>

      {insights.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TOM.good.box}`}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {TOM.good.icon}
            </svg>
          </span>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Tudo em dia. Nenhuma conta atrasada e nenhum gasto fora do normal.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {insights.map((i) => (
            <li key={i.id}>
              <Link
                href={i.href}
                className="flex h-full items-start gap-3 rounded-2xl bg-slate-50 p-4 transition motion-reduce:transition-none hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-slate-800/50 dark:hover:bg-slate-800"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TOM[i.tone].box}`}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {TOM[i.tone].icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{i.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{i.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
