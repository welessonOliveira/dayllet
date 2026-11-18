"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function getSystemTheme(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" || (theme === "system" && getSystemTheme());
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        saved = stored;
      }
    } catch {
      // Ignora erro se localStorage estiver bloqueado
    }

    setThemeState(saved);
    applyTheme(saved);
    setMounted(true);

    function onThemeChange(e: Event) {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail);
      }
    }

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        const next = (e.newValue as Theme) || "system";
        setThemeState(next);
        applyTheme(next);
      }
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function onMediaChange() {
      try {
        const cur = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
        if (cur === "system") {
          applyTheme("system");
        }
      } catch {
        applyTheme("system");
      }
    }

    window.addEventListener("theme-change", onThemeChange);
    window.addEventListener("storage", onStorage);
    mql.addEventListener("change", onMediaChange);

    return () => {
      window.removeEventListener("theme-change", onThemeChange);
      window.removeEventListener("storage", onStorage);
      mql.removeEventListener("change", onMediaChange);
    };
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Ignora erro se localStorage estiver indisponível
    }
    applyTheme(next);
    window.dispatchEvent(
      new CustomEvent<Theme>("theme-change", { detail: next }),
    );
  }

  return { theme, setTheme, mounted };
}

/**
 * Botão compacto que alterna em ciclo: Automático -> Claro -> Escuro -> Automático
 */
export function ThemeToggleButton({
  className = "",
}: {
  className?: string;
}) {
  const { theme, setTheme, mounted } = useTheme();

  function cycleTheme() {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  }

  // Textos e ícones de acordo com o tema
  let label = "Tema: Automático (segue o sistema). Clique para mudar para Claro.";
  let title = "Tema: Automático (segue o sistema)";

  if (mounted) {
    if (theme === "light") {
      label = "Tema: Claro. Clique para mudar para Escuro.";
      title = "Tema: Claro";
    } else if (theme === "dark") {
      label = "Tema: Escuro. Clique para mudar para Automático.";
      title = "Tema: Escuro";
    }
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={title}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition motion-reduce:transition-none hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 md:min-h-9 md:min-w-9 md:py-1.5 md:px-2.5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${className}`}
    >
      {/* Ícone Sol (Claro) */}
      {theme === "light" && (
        <svg
          className="h-4 w-4 text-amber-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}

      {/* Ícone Lua (Escuro) */}
      {theme === "dark" && (
        <svg
          className="h-4 w-4 text-violet-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}

      {/* Ícone Monitor / Automático */}
      {theme === "system" && (
        <svg
          className="h-4 w-4 text-slate-500 dark:text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )}

      <span className="sr-only">{title}</span>
    </button>
  );
}

/**
 * Seletor segmentado com 3 opções explícitas (Claro, Escuro e Automático)
 * Ideal para o menu móvel "Mais" ou telas de configuração
 */
export function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Escolha do tema visual"
      className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          theme === "light"
            ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <svg
          className="h-3.5 w-3.5 text-amber-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <span>Claro</span>
      </button>

      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          theme === "dark"
            ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <svg
          className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span>Escuro</span>
      </button>

      <button
        type="button"
        aria-pressed={theme === "system"}
        onClick={() => setTheme("system")}
        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          theme === "system"
            ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <svg
          className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>Auto</span>
      </button>
    </div>
  );
}
