// "Baixar meus dados" (LGPD): GET /api/export/meus-dados -> JSON com tudo do usuário logado.
import { NextResponse } from "next/server";
import { exportUserData } from "@/server/account";
import { getActionCtx } from "@/server/session";

export async function GET() {
  const ctx = await getActionCtx();
  if (!ctx) return NextResponse.json({ error: "Faça login pra baixar seus dados." }, { status: 401 });
  const data = await exportUserData(ctx);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados-dayllet.json"',
      "Cache-Control": "no-store",
    },
  });
}
