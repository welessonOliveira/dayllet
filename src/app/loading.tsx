export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      className="space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-xl skeleton" />
          <div className="h-4 w-64 rounded-lg skeleton" />
        </div>
        <div className="h-11 w-48 rounded-2xl skeleton" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-4 w-24 rounded-lg skeleton" />
            <div className="mt-4 h-8 w-36 rounded-xl skeleton" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="h-5 w-44 rounded-lg skeleton" />
          <div className="mt-6 space-y-3">
            <div className="skeleton h-12 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
          </div>
        </div>
        <div className="h-72 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="h-5 w-44 rounded-lg skeleton" />
          <div className="mt-6 space-y-3">
            <div className="skeleton h-12 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
