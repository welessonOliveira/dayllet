"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: ReactNode;
};

const LINKS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    mobileLabel: "Início",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="2" />
        <rect x="14" y="3" width="7" height="5" rx="2" />
        <rect x="14" y="12" width="7" height="9" rx="2" />
        <rect x="3" y="16" width="7" height="5" rx="2" />
      </svg>
    ),
  },
  {
    href: "/transacoes",
    label: "Transações",
    mobileLabel: "Transações",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 16V4m0 0L3 8m4-4l4 4" />
        <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    href: "/categorias",
    label: "Categorias",
    mobileLabel: "Categorias",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6a2 2 0 012-2h4.586a1 1 0 01.707.293l7.414 7.414a2 2 0 010 2.828l-4.586 4.586a2 2 0 01-2.828 0L3.879 11.707A1 1 0 013.586 11V6z" />
        <circle cx="8.5" cy="8.5" r="1.25" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/orcamentos",
    label: "Orçamentos",
    mobileLabel: "Orçamentos",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
];

export function MainNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Topo — marca no celular + barra de navegação completa no desktop */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="-mx-1.5 flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2.5" y="6" width="19" height="13" rx="3" />
                <path d="M2.5 10.5h19" />
                <circle cx="16.5" cy="14.5" r="1.25" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-slate-900">
                Finanças
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Gestão pessoal
              </span>
            </div>
          </Link>

          {/* Menu Desktop */}
          <nav
            aria-label="Menu principal"
            className="hidden items-center gap-1.5 md:flex"
          >
            {LINKS.map((item) => {
              const ativo = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    ativo
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Menu fixo no rodapé do celular */}
      <nav
        aria-label="Menu inferior"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {LINKS.map((item) => {
            const ativo = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
                  ativo ? "text-violet-600" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {ativo && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-violet-600" />
                )}
                {item.icon}
                <span>{item.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
