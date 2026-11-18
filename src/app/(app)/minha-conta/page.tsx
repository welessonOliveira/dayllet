import { redirect } from "next/navigation";
import { MyAccountClient } from "@/components/MyAccountClient";
import { getPageCtx, getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function MinhaContaPage() {
  await getPageCtx();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <MyAccountClient user={user} />;
}
