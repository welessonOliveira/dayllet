"use client";

// Área de "arraste o arquivo aqui ou clique" (visual inspirado no file-uploader do 21st.dev).
// Por baixo é um <input type="file"> de verdade, com `name`: funciona dentro de <form>/FormData.
import { useRef, useState } from "react";

type FileDropzoneProps = {
  id: string;
  name: string;
  accept: string;
  /** Texto pequeno embaixo (formatos e tamanho). */
  hint: string;
  required?: boolean;
  disabled?: boolean;
};

function tamanho(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDropzone({ id, name, accept, hint, required, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);

  function usar(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f && inputRef.current && inputRef.current.files !== files) {
      // Arquivo veio do arrastar: coloca no input pra ir junto com o formulário.
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    setArquivo(f);
  }

  function remover() {
    if (inputRef.current) inputRef.current.value = "";
    setArquivo(null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={(e) => usar(e.target.files)}
        className="sr-only"
        aria-describedby={`${id}-hint`}
      />

      {arquivo ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{arquivo.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tamanho(arquivo.size)}</p>
          </div>
          <button
            type="button"
            onClick={remover}
            disabled={disabled}
            aria-label={`Remover ${arquivo.name}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 transition motion-reduce:transition-none hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            if (!disabled) usar(e.dataTransfer.files);
          }}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition motion-reduce:transition-none ${
            arrastando
              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
              : "border-slate-300 bg-slate-50/70 hover:border-violet-400 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-violet-500"
          }`}
        >
          <svg
            className={`h-9 w-9 text-violet-600 dark:text-violet-400 ${arrastando ? "" : "motion-safe:animate-bounce"}`}
            style={{ animationDuration: "2s" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 16V4m0 0-4 4m4-4 4 4" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <span className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Arraste o extrato aqui ou <span className="text-violet-700 underline underline-offset-2 dark:text-violet-400">escolha o arquivo</span>
          </span>
          <span id={`${id}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </span>
        </label>
      )}
    </div>
  );
}
