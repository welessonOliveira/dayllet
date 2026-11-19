import { MainNav } from "@/components/MainNav";
import { SectionTabs } from "@/components/SectionTabs";
import { getSessionUser } from "@/server/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    // PC: menu lateral + conteúdo lado a lado. Celular: topo + conteúdo + barra inferior.
    <div className="lg:flex">
      <MainNav user={user} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-6 md:pt-8 lg:px-8 lg:pb-12">
          <SectionTabs />
          {children}
        </main>
      </div>
    </div>
  );
}
