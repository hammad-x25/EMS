"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

const demos = [
  { label: "Administrator", email: "admin@aegisexam.local", password: "Admin@123!" },
  { label: "Examiner", email: "examiner1@aegisexam.local", password: "Examiner@123!" },
  { label: "Candidate", email: "candidate1@aegisexam.local", password: "Candidate@123!" },
];

type LoginResponse = { user?: { role: "ADMIN" | "EXAMINER" | "CANDIDATE" }; error?: { message?: string } };

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as LoginResponse;
      if (!response.ok || !body.user) throw new Error(body.error?.message ?? "Unable to sign in");
      const destination = body.user.role === "ADMIN" ? "/admin" : body.user.role === "EXAMINER" ? "/examiner" : "/candidate";
      router.push(destination);
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {demoMode ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-slate-700">Evaluation quick fill</legend>
          <div className="grid grid-cols-3 gap-2">
            {demos.map((demo) => (
              <button className="btn-secondary px-2 text-xs" key={demo.label} onClick={() => { setEmail(demo.email); setPassword(demo.password); }} type="button">
                {demo.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="block text-sm font-bold text-slate-700">Email address
        <input autoComplete="email" className="field mt-2" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      </label>
      <label className="block text-sm font-bold text-slate-700">Password
        <input autoComplete="current-password" className="field mt-2" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
      </label>
      {error ? <div aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      <button className="btn-primary w-full" disabled={loading} type="submit">
        {loading ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}
        {loading ? "Signing in…" : "Sign in securely"}
      </button>
    </form>
  );
}
