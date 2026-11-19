// Regras dos comprovantes que não dependem do banco (dá pra usar no navegador também).

/** Tamanho máximo de um comprovante (o limite das Server Actions é 2 MB). */
export const ATTACHMENT_MAX_BYTES = 1.5 * 1024 * 1024;
/** Espaço total de comprovantes por usuário (o banco grátis é pequeno). */
export const ATTACHMENT_QUOTA_BYTES = 50 * 1024 * 1024;
/** Na conta de demonstração o espaço é bem menor. */
export const ATTACHMENT_DEMO_QUOTA_BYTES = 5 * 1024 * 1024;
/** O que o seletor de arquivo aceita. */
export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type AttachmentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/**
 * Descobre o tipo pelos primeiros bytes ("assinatura" do arquivo).
 * Não confia no nome nem no tipo que o navegador manda: um .exe renomeado pra .pdf é recusado.
 */
export function detectAttachmentMime(bytes: Uint8Array): AttachmentMime | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

/** Nome de arquivo seguro pra guardar e mostrar (sem pastas, sem caracteres de controle, até 100 letras). */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const limpo = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(-100);
  return limpo || "comprovante";
}

/** "1,2 MB" / "350 KB". */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
