import type { Metadata } from "next";
import { MainNav } from "@/components/MainNav";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanças — Gestão financeira pessoal",
  description: "Controle de receitas, despesas, categorias e orçamentos mensais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <ToastProvider>
          <MainNav />
          <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-12">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
