"use client";
// Menu principal (PLACEHOLDER: o Gemini vai refazer o visual).
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/transacoes", label: "Transações" },
  { href: "/categorias", label: "Categorias" },
  { href: "/orcamentos", label: "Orçamentos" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-4 border-b px-4 py-3">
      <span className="font-bold">Finanças</span>
      {LINKS.map((l) => {
        const ativo = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={ativo ? "font-semibold underline" : "hover:underline"}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
