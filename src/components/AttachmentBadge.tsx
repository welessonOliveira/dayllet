// Clipe ao lado da descrição: abre o comprovante do lançamento numa aba nova.
import type { AttachmentInfo } from "@/server/attachments";

export function AttachmentBadge({ transactionId, attachment }: { transactionId: string; attachment: AttachmentInfo }) {
  return (
    <a
      href={`/api/comprovantes/${transactionId}`}
      target="_blank"
      rel="noopener"
      title={`Abrir comprovante (${attachment.fileName})`}
      aria-label={`Abrir comprovante: ${attachment.fileName}`}
      className="inline-flex min-h-7 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-violet-950/60 dark:hover:text-violet-200"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      Comprovante
    </a>
  );
}
