import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dayllet — Finanças pessoais do dia a dia",
  description:
    "Controle de contas, receitas, despesas, categorias e orçamentos mensais",
  applicationName: "Dayllet",
  // No iPhone, "Adicionar à Tela de Início" abre em tela cheia.
  appleWebApp: { capable: true, title: "Dayllet", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e6" },
    { media: "(prefers-color-scheme: dark)", color: "#2d2621" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark")}else{document.documentElement.classList.remove("dark")}if(localStorage.getItem("nav-collapsed")==="1"){document.documentElement.dataset.nav="collapsed"}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
