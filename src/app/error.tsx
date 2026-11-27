"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <section className="card w-full max-w-md space-y-4 p-8 text-center">
        <AlertTriangle className="mx-auto text-rose-600" size={44} />
        <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-600">
          The page could not be rendered cleanly. Your session and saved examination progress remain protected.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button className="btn-primary text-sm" onClick={() => reset()} type="button">
            <RotateCcw size={15} /> Try again
          </button>
          <Link className="btn-secondary text-sm" href="/">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
