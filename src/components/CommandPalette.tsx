"use client";

// Busca rápida (Ctrl+K ou ⌘K): digita e vai direto pra uma página, uma ação
// ou pra busca nas transações do mês.
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ICONS, OPEN_SEARCH_EVENT, SECTIONS } from "./navConfig";

type Item = { id: string; label: string; hint: string; icon: ReactNode; href: string; keywords?: string };

const ITENS: Item[] = [
  { id: "nova", label: "Nova transação", hint: "Lançar receita ou despesa", icon: ICONS.plus, href: "/transacoes?nova=1", keywords: "adicionar gasto despesa receita lancar" },
  ...SECTIONS.flatMap((s) =>
    s.tabs.map((t) => ({
      id: t.href,
      label: t.label,
      hint: s.tabs.length > 1 ? `${s.label} · ${t.description}` : t.description,
      icon: t.icon,
      href: t.href,
      keywords: s.label,
    })),
  ),
  { id: "conta", label: "Minha conta", hint: "Seus dados, exportar e excluir conta", icon: ICONS.user, href: "/minha-conta", keywords: "perfil lgpd" },
];

/** Tira acento e põe em minúsculas, pra "orcamento" achar "Orçamentos". */
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    const abrir = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, abrir);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, abrir);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const resultados = useMemo(() => {
    const termo = norm(q.trim());
    const lista = termo
      ? ITENS.filter((i) => norm(`${i.label} ${i.hint} ${i.keywords ?? ""}`).includes(termo))
      : ITENS;
    const busca: Item[] = q.trim()
      ? [
          {
            id: "buscar",
            label: `Buscar “${q.trim()}” nas transações`,
            hint: "Procura na descrição dos lançamentos do mês",
            icon: ICONS.search,
            href: `/transacoes?q=${encodeURIComponent(q.trim())}`,
          },
        ]
      : [];
    return [...lista, ...busca];
  }, [q]);

  useEffect(() => setSel(0), [q]);

  function ir(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 px-4 pt-[12dvh] backdrop-blur-[2px]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida"
        onMouseDown={(e) => e.stopPropagation()}
        className="page-in w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 dark:border-slate-800">
          <span className="text-slate-400">{ICONS.search}</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, resultados.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                ir(resultados[sel]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Ir para uma página ou buscar transação…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="busca-resultados"
            aria-activedescendant={resultados[sel] ? `busca-${resultados[sel].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block dark:border-slate-700">
            Esc
          </kbd>
        </div>
        <ul id="busca-resultados" role="listbox" className="max-h-[50dvh] overflow-y-auto p-2">
          {resultados.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nada encontrado.</li>}
          {resultados.map((item, i) => (
            <li
              key={item.id}
              id={`busca-${item.id}`}
              role="option"
              aria-selected={i === sel}
              onMouseEnter={() => setSel(i)}
              onClick={() => ir(item)}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${
                i === sel ? "bg-violet-50 text-violet-900 dark:bg-violet-950/60 dark:text-violet-100" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <span className={i === sel ? "text-violet-700 dark:text-violet-300" : "text-slate-400"}>{item.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
