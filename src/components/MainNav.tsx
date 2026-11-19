"use client";

// Navegação do app.
// - PC (lg+): menu lateral com as 5 seções; dá pra recolher e deixar só os ícones.
// - Celular/tablet: topo enxuto (logo, busca, avatar) + barra inferior com o botão "+" no meio.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/server/session";
import { CommandPalette } from "./CommandPalette";
import { ICONS, SECTIONS, isTabActive, openSearch, sectionOf } from "./navConfig";
import { ThemeSegmentedControl } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

type MainNavProps = {
  user?: SessionUser | null;
};

const NOVA_TRANSACAO = "/transacoes?nova=1";

function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <Link
      href="/"
      className="flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="6" width="19" height="13" rx="3" />
          <path d="M2.5 10.5h19" />
          <circle cx="16.5" cy="14.5" r="1.25" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {withName && (
        <span className="text-base font-bold tracking-tight text-slate-900 nav-collapsed:hidden dark:text-slate-100">Dayllet</span>
      )}
    </Link>
  );
}

export function MainNav({ user }: MainNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const atual = sectionOf(pathname);

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  function alternarRecolhido() {
    const html = document.documentElement;
    const recolher = html.dataset.nav !== "collapsed";
    if (recolher) html.dataset.nav = "collapsed";
    else delete html.dataset.nav;
    try {
      localStorage.setItem("nav-collapsed", recolher ? "1" : "0");
    } catch {
      // localStorage bloqueado: só não lembra da escolha
    }
  }

  // Barra inferior do celular: Início, Transações, [+], Planejamento, Mais
  const inicio = SECTIONS[0];
  const transacoes = SECTIONS[1];
  const planejamento = SECTIONS[3];
  const noMais = SECTIONS.filter((s) => s !== inicio && s !== transacoes && s !== planejamento);
  const maisAtivo = moreOpen || noMais.some((s) => s === atual) || pathname === "/minha-conta";

  return (
    <>
      <CommandPalette />

      {/* ===== PC: menu lateral ===== */}
      <aside
        aria-label="Menu principal"
        className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 px-3 py-4 transition-[width] duration-200 motion-reduce:transition-none lg:flex nav-collapsed:w-[76px] dark:border-slate-800 dark:bg-slate-950/60"
      >
        <div className="flex items-center justify-between gap-2 px-1.5 nav-collapsed:justify-center">
          <Logo />
          <button
            type="button"
            onClick={alternarRecolhido}
            aria-label="Recolher ou expandir o menu"
            title="Recolher/expandir menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 nav-collapsed:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16M15 10l-2 2 2 2" />
            </svg>
          </button>
        </div>
        {/* Recolhido: o botão de expandir aparece embaixo do logo */}
        <button
          type="button"
          onClick={alternarRecolhido}
          aria-label="Expandir o menu"
          className="mx-auto mt-2 hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 nav-collapsed:flex dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16M13 10l2 2-2 2" />
          </svg>
        </button>

        <Link
          href={NOVA_TRANSACAO}
          title="Nova transação"
          className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {ICONS.plus}
          <span className="nav-collapsed:sr-only">Nova transação</span>
        </Link>

        <button
          type="button"
          onClick={openSearch}
          title="Buscar (Ctrl+K)"
          className="mt-2 flex min-h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 transition motion-reduce:transition-none hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 nav-collapsed:justify-center nav-collapsed:px-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
        >
          {ICONS.search}
          <span className="flex-1 text-left nav-collapsed:sr-only">Buscar</span>
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] font-semibold text-slate-400 nav-collapsed:hidden dark:border-slate-700">
            Ctrl K
          </kbd>
        </button>

        <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto">
          {SECTIONS.map((s) => {
            const ativo = s === atual;
            return (
              <div key={s.href}>
                <Link
                  href={s.href}
                  title={s.label}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 nav-collapsed:justify-center nav-collapsed:px-0 ${
                    ativo
                      ? "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  {s.icon}
                  <span className="nav-collapsed:sr-only">{s.label}</span>
                </Link>
                {/* Sub-itens da seção aberta (só com o menu expandido) */}
                {ativo && s.tabs.length > 1 && (
                  <ul className="mt-1 mb-1 ml-[1.35rem] space-y-0.5 border-l border-slate-200 pl-3 nav-collapsed:hidden dark:border-slate-800">
                    {s.tabs.map((t) => {
                      const tabAtiva = isTabActive(t.href, pathname);
                      return (
                        <li key={t.href}>
                          <Link
                            href={t.href}
                            aria-current={tabAtiva ? "page" : undefined}
                            className={`flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-medium transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                              tabAtiva
                                ? "text-violet-800 dark:text-violet-200"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            }`}
                          >
                            {t.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {user && (
          <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
            <UserMenu user={user} placement="up" showName />
          </div>
        )}
      </aside>

      {/* ===== Celular/tablet: topo enxuto ===== */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 md:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openSearch}
              aria-label="Buscar"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {ICONS.search}
            </button>
            {user && <UserMenu user={user} placement="down" />}
          </div>
        </div>
      </header>

      {/* Menu "Mais" do celular */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-label="Mais páginas"
            onClick={(e) => e.stopPropagation()}
            className="page-in fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            {SECTIONS.filter((s) => s.tabs.length > 1 || noMais.includes(s)).map((s) => (
              <div key={s.href} className="mb-3 last:mb-0">
                <p className="mb-1.5 px-1 text-[11px] font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">{s.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {s.tabs.map((t) => {
                    const ativo = isTabActive(t.href, pathname);
                    return (
                      <Link
                        key={t.href}
                        href={t.href}
                        aria-current={ativo ? "page" : undefined}
                        className={`flex min-h-12 items-center gap-2.5 rounded-2xl px-3 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          ativo
                            ? "bg-violet-600 text-white"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <span className="mb-2 block px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Tema</span>
              <ThemeSegmentedControl />
            </div>
          </div>
        </div>
      )}

      {/* ===== Celular/tablet: barra inferior ===== */}
      <nav
        aria-label="Menu inferior"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center gap-0.5">
          {[inicio, transacoes].map((s) => (
            <BottomLink key={s.href} href={s.href} label={s.label} icon={s.icon} active={s === atual && !moreOpen} />
          ))}
          <div className="flex justify-center">
            <Link
              href={NOVA_TRANSACAO}
              aria-label="Nova transação"
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg ring-4 ring-white transition motion-reduce:transition-none active:scale-95 focus-visible:outline-none focus-visible:ring-violet-500 dark:ring-slate-950"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Link>
          </div>
          <BottomLink href={planejamento.href} label="Planejar" icon={planejamento.icon} active={planejamento === atual && !moreOpen} />
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
              maisAtivo ? "text-violet-700 dark:text-violet-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {maisAtivo && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-violet-600 dark:bg-violet-400" />}
            {ICONS.more}
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function BottomLink({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
        active ? "text-violet-700 dark:text-violet-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {active && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-violet-600 dark:bg-violet-400" />}
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
