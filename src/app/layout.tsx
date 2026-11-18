import type { Metadata } from "next";
import { MainNav } from "@/components/MainNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanças",
  description: "Gestão financeira pessoal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <MainNav />
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
