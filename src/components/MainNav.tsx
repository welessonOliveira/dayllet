"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/session";
import { AuthSubmitButton } from "./AuthSubmitButton";

type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: ReactNode;
  primaryMobile?: boolean;
};

const LINKS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    mobileLabel: "Início",
    primaryMobile: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    primaryMobile: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 16V4m0 0L3 8m4-4l4 4" />
        <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    href: "/contas",
    label: "Contas",
    mobileLabel: "Contas",
    primaryMobile: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" />
        <path d="M16 12h5" />
      </svg>
    ),
  },
  {
    href: "/recorrentes",
    label: "Recorrentes",
    mobileLabel: "Recorrentes",
    primaryMobile: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
  },
  {
    href: "/fluxo",
    label: "Fluxo de caixa",
    mobileLabel: "Fluxo",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v18h18" />
        <rect x="7" y="10" width="3" height="7" rx="0.8" />
        <rect x="12" y="6" width="3" height="11" rx="0.8" />
        <rect x="17" y="13" width="3" height="4" rx="0.8" />
      </svg>
    ),
  },
  {
    href: "/importar",
    label: "Importar",
    mobileLabel: "Importar",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    ),
  },
  {
    href: "/metas",
    label: "Metas",
    mobileLabel: "Metas",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    mobileLabel: "Relatórios",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    href: "/categorias",
    label: "Categorias",
    mobileLabel: "Categorias",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
];

type MainNavProps = {
  user?: SessionUser | null;
};

export function MainNav({ user }: MainNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const primaryMobileLinks = LINKS.filter((l) => l.primaryMobile);
  const secondaryMobileLinks = LINKS.filter((l) => !l.primaryMobile);
  const secondaryActive =
    secondaryMobileLinks.some((l) => isActive(l.href)) ||
    pathname === "/minha-conta";

  const displayName = user?.name || user?.email || "Usuário";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6">
          <Link
            href="/"
            className="-mx-1.5 flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-1.5 transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
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
            <span className="text-base font-bold tracking-tight text-slate-900">
              Finanças
            </span>
          </Link>

          {/* Menu Desktop */}
          <nav
            aria-label="Menu principal"
            className="order-3 hidden w-full flex-wrap items-center gap-1 border-t border-slate-100 pt-2 md:flex lg:order-2 lg:w-auto lg:border-t-0 lg:pt-0"
          >
            {LINKS.map((item) => {
              const ativo = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 xl:px-3.5 xl:text-sm ${
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

          {/* Usuário logado + link Minha conta + selo Demo + botão Sair */}
          {user && (
            <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
              <Link
                href="/minha-conta"
                aria-current={pathname === "/minha-conta" ? "page" : undefined}
                aria-label={`Minha conta (${displayName})`}
                title={
                  user.isDemo
                    ? "Minha conta (demonstração exclusiva por 24h)"
                    : "Minha conta"
                }
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 ${
                  pathname === "/minha-conta"
                    ? "border-violet-300 bg-violet-100 text-violet-900"
                    : "border-slate-200/80 bg-slate-100/85 text-slate-700 hover:border-slate-300 hover:bg-slate-200/70"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0 text-violet-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
                <span className="max-w-20 truncate text-xs font-semibold sm:max-w-28">
                  {displayName}
                </span>
                {user.isDemo && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Demo
                  </span>
                )}
                <span className="hidden border-l border-slate-300/80 pl-1.5 text-xs font-semibold text-violet-700 sm:inline">
                  Minha conta
                </span>
              </Link>

              <form action={signOutAction}>
                <AuthSubmitButton
                  pendingLabel="Saindo..."
                  ariaLabel="Sair da conta"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition motion-reduce:transition-none hover:bg-slate-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 md:min-h-9 md:min-w-0 md:py-1.5"
                >
                  Sair
                </AuthSubmitButton>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Menu "Mais" no celular (acima da barra inferior) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Mais páginas"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-3 bottom-20 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl"
          >
            <div className="grid grid-cols-2 gap-2">
              {secondaryMobileLinks.map((item) => {
                const ativo = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={ativo ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                      ativo
                        ? "bg-violet-600 text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {user && (
                <Link
                  href="/minha-conta"
                  aria-current={pathname === "/minha-conta" ? "page" : undefined}
                  className={`col-span-2 flex min-h-12 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                    pathname === "/minha-conta"
                      ? "bg-violet-600 text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                  <span>Minha conta (LGPD)</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu fixo no rodapé do celular (4 abas principais + Mais = 5 alvos >= 44px) */}
      <nav
        aria-label="Menu inferior"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5">
          {primaryMobileLinks.map((item) => {
            const ativo = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
                  ativo ? "text-violet-600" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {ativo && (
                  <span className="absolute top-0 h-0.5 w-7 rounded-full bg-violet-600" />
                )}
                {item.icon}
                <span className="truncate">{item.mobileLabel}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
              secondaryActive || moreOpen
                ? "text-violet-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {secondaryActive && (
              <span className="absolute top-0 h-0.5 w-7 rounded-full bg-violet-600" />
            )}
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
