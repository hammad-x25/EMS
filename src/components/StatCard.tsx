import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, detail, icon: Icon }: { label: string; value: number | string; detail: string; icon: LucideIcon }) {
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>
        <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Icon size={20} /></span>
      </div>
      <p className="mt-4 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
