"use client";

// Abas da seção atual (ex.: Planejamento → Orçamentos | Metas | Categorias).
// Aparece sozinha no topo das páginas que fazem parte de uma seção com mais de uma aba.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isTabActive, sectionOf } from "./navConfig";

export function SectionTabs() {
  const pathname = usePathname();
  const secao = sectionOf(pathname);
  if (!secao || secao.tabs.length < 2) return null;

  return (
    <nav aria-label={`Abas de ${secao.label}`} className="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {secao.tabs.map((t) => {
          const ativa = isTabActive(t.href, pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={ativa ? "page" : undefined}
              className={`flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 [&_svg]:h-4 [&_svg]:w-4 ${
                ativa
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
