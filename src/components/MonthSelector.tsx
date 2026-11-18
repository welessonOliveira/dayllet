"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { currentMonth, formatMonthLabel, isValidMonth, shiftMonth } from "@/lib/dates";

type MonthSelectorProps = {
  month: string;
  /** Parâmetros extras da URL que devem ser mantidos ao trocar o mês (ex.: filtros). */
  extraParams?: Record<string, string | undefined>;
};

function buildHref(
  pathname: string,
  month: string,
  extraParams?: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  sp.set("month", month);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) sp.set(k, v);
    }
  }
  return `${pathname}?${sp.toString()}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function MonthSelector({ month, extraParams }: MonthSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();
  const isCurrent = month === thisMonth;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={`inline-flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-white p-1 shadow-xs transition-opacity motion-reduce:transition-none ${
          isPending ? "opacity-65" : ""
        }`}
      >
        <Link
          href={buildHref(pathname, prevMonth, extraParams)}
          aria-label="Mês anterior"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition motion-reduce:transition-none hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:h-9 md:w-9"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
        </Link>

        <label className="relative flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 transition motion-reduce:transition-none hover:text-violet-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500 has-[:focus-visible]:ring-offset-2 md:min-h-9">
          <svg
            className="h-4 w-4 text-violet-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
              clipRule="evenodd"
            />
          </svg>
          <span>{capitalize(formatMonthLabel(month))}</span>
          <input
            type="month"
            aria-label="Selecionar mês"
            value={month}
            onChange={(e) => {
              const val = e.target.value;
              if (isValidMonth(val)) {
                startTransition(() => {
                  router.push(buildHref(pathname, val, extraParams));
                });
              }
            }}
            className="sr-only"
          />
        </label>

        <Link
          href={buildHref(pathname, nextMonth, extraParams)}
          aria-label="Próximo mês"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition motion-reduce:transition-none hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:h-9 md:w-9"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>

      {!isCurrent && (
        <Link
          href={buildHref(pathname, thisMonth, extraParams)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-700 transition motion-reduce:transition-none hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9"
        >
          Mês atual
        </Link>
      )}
    </div>
  );
}
