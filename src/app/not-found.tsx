import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <span className="text-lg font-bold">404</span>
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          O endereço que você tentou acessar não existe no Finanças.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition motion-reduce:transition-none hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Voltar para o Dashboard
        </Link>
      </div>
    </div>
  );
}
