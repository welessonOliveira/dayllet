export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      className="animate-pulse space-y-6 motion-reduce:animate-none"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-xl bg-slate-200/80" />
          <div className="h-4 w-64 rounded-lg bg-slate-200/60" />
        </div>
        <div className="h-11 w-48 rounded-2xl bg-slate-200/70" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs"
          >
            <div className="h-4 w-24 rounded-lg bg-slate-200/70" />
            <div className="mt-4 h-8 w-36 rounded-xl bg-slate-200/80" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <div className="h-5 w-44 rounded-lg bg-slate-200/70" />
          <div className="mt-6 space-y-3">
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
          </div>
        </div>
        <div className="h-72 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <div className="h-5 w-44 rounded-lg bg-slate-200/70" />
          <div className="mt-6 space-y-3">
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
