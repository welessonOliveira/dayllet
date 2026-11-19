// Mapa de navegação do Dayllet: 5 seções principais, cada uma com suas abas.
// Usado pelo menu lateral, pela barra do celular, pelas abas das seções e pela busca (Ctrl+K).
import type { ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg
    className="h-5 w-5 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const ICONS = {
  home: svg(
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>,
  ),
  transactions: svg(
    <>
      <path d="M7 16V4m0 0L3 8m4-4 4 4" />
      <path d="M17 8v12m0 0 4-4m-4 4-4-4" />
    </>,
  ),
  wallet: svg(
    <>
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z" />
      <path d="M16 12h5" />
    </>,
  ),
  plan: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>,
  ),
  reports: svg(
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>,
  ),
  recurring: svg(
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>,
  ),
  import: svg(
    <>
      <path d="M12 3v12m0 0-4-4m4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>,
  ),
  budget: svg(<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />),
  tag: svg(
    <>
      <path d="M4 6a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l7.414 7.414a2 2 0 0 1 0 2.828l-4.586 4.586a2 2 0 0 1-2.828 0L3.879 11.707A1 1 0 0 1 3.586 11V6z" />
      <circle cx="8.5" cy="8.5" r="1.25" fill="currentColor" />
    </>,
  ),
  flow: svg(
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="7" rx="0.8" />
      <rect x="12" y="6" width="3" height="11" rx="0.8" />
      <rect x="17" y="13" width="3" height="4" rx="0.8" />
    </>,
  ),
  user: svg(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  ),
  search: svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
  ),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  more: svg(
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </>,
  ),
};

export type NavTab = { href: string; label: string; icon: ReactNode; description: string };
export type NavSection = { href: string; label: string; icon: ReactNode; tabs: NavTab[] };

export const SECTIONS: NavSection[] = [
  {
    href: "/",
    label: "Início",
    icon: ICONS.home,
    tabs: [{ href: "/", label: "Início", icon: ICONS.home, description: "Resumo do mês, saldos e dicas" }],
  },
  {
    href: "/transacoes",
    label: "Transações",
    icon: ICONS.transactions,
    tabs: [
      { href: "/transacoes", label: "Lançamentos", icon: ICONS.transactions, description: "Receitas e despesas do mês" },
      { href: "/recorrentes", label: "Recorrentes", icon: ICONS.recurring, description: "Contas fixas e parcelamentos" },
      { href: "/importar", label: "Importar extrato", icon: ICONS.import, description: "Trazer o extrato do banco (OFX ou CSV)" },
    ],
  },
  {
    href: "/contas",
    label: "Contas",
    icon: ICONS.wallet,
    tabs: [{ href: "/contas", label: "Contas e cartões", icon: ICONS.wallet, description: "Saldos, cartões e faturas" }],
  },
  {
    href: "/orcamentos",
    label: "Planejamento",
    icon: ICONS.plan,
    tabs: [
      { href: "/orcamentos", label: "Orçamentos", icon: ICONS.budget, description: "Limite de gasto por categoria" },
      { href: "/metas", label: "Metas", icon: ICONS.plan, description: "Reservas e objetivos" },
      { href: "/categorias", label: "Categorias", icon: ICONS.tag, description: "Organizar receitas e despesas" },
    ],
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: ICONS.reports,
    tabs: [
      { href: "/relatorios", label: "Relatórios", icon: ICONS.reports, description: "Resumo por período e inflação" },
      { href: "/fluxo", label: "Fluxo de caixa", icon: ICONS.flow, description: "Entradas e saídas ao longo do tempo" },
    ],
  },
];

/** A página atual pertence a esta aba? ("/" só casa exatamente.) */
export function isTabActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Seção da página atual (ou undefined, ex.: Minha conta). */
export function sectionOf(pathname: string): NavSection | undefined {
  return SECTIONS.find((s) => s.tabs.some((t) => isTabActive(t.href, pathname)));
}

/** Evento pra abrir a busca (Ctrl+K) a partir de qualquer botão. */
export const OPEN_SEARCH_EVENT = "dayllet:open-search";
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
