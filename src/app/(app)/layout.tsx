import { MainNav } from "@/components/MainNav";
import { getSessionUser } from "@/server/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <>
      <MainNav user={user} />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-12">
        {children}
      </main>
    </>
  );
}
