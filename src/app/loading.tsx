export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="card flex items-center gap-3 px-6 py-4 text-sm font-bold text-slate-700" role="status" aria-live="polite">
        <span className="h-3 w-3 animate-pulse rounded-full bg-indigo-600" />
        Loading AegisExam…
      </div>
    </main>
  );
}
