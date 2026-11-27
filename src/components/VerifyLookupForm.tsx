"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

export function VerifyLookupForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    router.push(`/verify/${encodeURIComponent(cleaned)}`);
  }

  return (
    <form className="mt-6 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-5" onSubmit={submit}>
      <label className="min-w-48 flex-1">
        <span className="sr-only">Verification code</span>
        <input
          className="field font-mono-tabular uppercase"
          onChange={(event) => setCode(event.target.value)}
          placeholder="AEG-XXXX-XXXX"
          value={code}
        />
      </label>
      <button className="btn-secondary" type="submit">
        <Search size={15} /> Verify another code
      </button>
    </form>
  );
}
