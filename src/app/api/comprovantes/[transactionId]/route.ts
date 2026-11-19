// Abre o comprovante de um lançamento: GET /api/comprovantes/<id da transação>
// (?baixar=1 baixa em vez de abrir). Só o dono consegue: a busca filtra pelo usuário logado.
import { NextResponse, type NextRequest } from "next/server";
import { getAttachmentFile } from "@/server/attachments";
import { getActionCtx } from "@/server/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ transactionId: string }> }) {
  const ctx = await getActionCtx();
  if (!ctx) return NextResponse.json({ error: "Faça login pra ver o comprovante." }, { status: 401 });

  const { transactionId } = await params;
  const file = await getAttachmentFile(ctx, transactionId);
  if (!file) return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });

  const modo = req.nextUrl.searchParams.get("baixar") === "1" ? "attachment" : "inline";
  return new NextResponse(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      // filename* aceita acento; o outro é o "plano B" sem acento pra navegador antigo.
      "Content-Disposition": `${modo}; filename="${file.fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
