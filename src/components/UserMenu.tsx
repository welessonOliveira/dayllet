"use client";

// Avatar do usuário que abre um menu: Minha conta, Tema e Sair.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/session";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { ICONS } from "./navConfig";
import { ThemeSegmentedControl } from "./ThemeToggle";

function iniciais(nome: string): string {
  // Só palavras com letras (ignora "(demo)", e-mail com números etc.).
  const partes = nome.split("@")[0].match(/\p{L}+/gu) ?? [];
  const primeira = partes[0] ?? "?";
  const ultima = partes[partes.length - 1] ?? "";
  const letras = partes.length > 1 ? primeira[0] + ultima[0] : primeira.slice(0, 2);
  return letras.toUpperCase();
}

export function Avatar({ user, size = 36 }: { user: SessionUser; size?: number }) {
  const nome = user.name || user.email || "Usuário";
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto do Google/GitHub, vem de outro domínio
      <img
        src={user.image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white"
      style={{ width: size, height: size }}
    >
      {iniciais(nome)}
    </span>
  );
}

type UserMenuProps = {
  user: SessionUser;
  /** "up": abre pra cima (rodapé do menu lateral) · "down": abre pra baixo (topo do celular). */
  placement: "up" | "down";
  /** Mostra nome e e-mail ao lado do avatar (menu lateral aberto). */
  showName?: boolean;
};

export function UserMenu({ user, placement, showName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const nome = user.name || user.email || "Usuário";

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu da conta (${nome})`}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left transition motion-reduce:transition-none hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-slate-800 ${
          showName ? "p-1.5 nav-collapsed:justify-center" : "justify-center p-1"
        }`}
      >
        <Avatar user={user} />
        {showName && (
          <span className="min-w-0 flex-1 nav-collapsed:hidden">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{nome}</span>
              {user.isDemo && (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                  Demo
                </span>
              )}
            </span>
            {(user.isDemo || user.email) && (
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {user.isDemo ? "Demonstração (24h)" : user.email}
              </span>
            )}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
            placement === "up" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"
          }`}
        >
          <div className="flex items-center gap-2.5 px-2 pt-1 pb-2.5">
            <Avatar user={user} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{nome}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user.isDemo ? "Conta de demonstração (24h)" : user.email}
              </p>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-1.5 dark:border-slate-800">
            <Link
              role="menuitem"
              href="/minha-conta"
              className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {ICONS.user}
              Minha conta
            </Link>
          </div>
          <div className="px-2.5 pt-2 pb-2.5">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Tema</span>
            <ThemeSegmentedControl />
          </div>
          <form action={signOutAction} className="border-t border-slate-100 pt-1.5 dark:border-slate-800">
            <AuthSubmitButton
              pendingLabel="Saindo..."
              ariaLabel="Sair da conta"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              Sair
            </AuthSubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
