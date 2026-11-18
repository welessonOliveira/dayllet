// Download do CSV das transações: GET /api/export/transacoes?month=2026-11&type=&categoryId=&walletId=&q=
// Exige login (o middleware deixa passar só quem tem cookie; aqui confere a sessão de verdade).
import { NextResponse, type NextRequest } from "next/server";
import { parseTransactionFilters } from "@/lib/validations";
import { exportTransactionsCsv } from "@/server/reports";
import { getActionCtx } from "@/server/session";

export async function GET(req: NextRequest) {
  const ctx = await getActionCtx();
  if (!ctx) return NextResponse.json({ error: "Faça login pra exportar." }, { status: 401 });

  const filters = parseTransactionFilters(Object.fromEntries(req.nextUrl.searchParams));
  const { fileName, content } = await exportTransactionsCsv(ctx, filters);
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
