"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { FormField } from "@/components/ui/FormField";
import { parseApiError, readApiJson } from "@/lib/form-errors";

const demos = [
  { label: "Administrator", email: "admin@aegisexam.local", password: "Admin@123!" },
  { label: "Examiner", email: "examiner1@aegisexam.local", password: "Examiner@123!" },
  { label: "Candidate", email: "candidate1@aegisexam.local", password: "Candidate@123!" },
];

type LoginResponse = { user?: { role: "ADMIN" | "EXAMINER" | "CANDIDATE" }; error?: { message?: string; details?: unknown } };

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await readApiJson<LoginResponse>(response);
      if (!response.ok || !body?.user) {
        const parsed = parseApiError(body, "Unable to sign in");
        setFieldErrors(parsed.fieldErrors);
        throw new Error(parsed.message);
      }
      const destination =
        body.user.role === "ADMIN" ? "/admin" : body.user.role === "EXAMINER" ? "/examiner" : "/candidate";
      router.push(destination);
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {demoMode ? (
        <fieldset className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Evaluation quick fill
          </legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {demos.map((demo) => (
              <button
                className="btn-secondary h-9 px-2 text-xs"
                key={demo.label}
                onClick={() => {
                  setEmail(demo.email);
                  setPassword(demo.password);
                  setError("");
                  setFieldErrors({});
                }}
                type="button"
              >
                {demo.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <FormField error={fieldErrors.email} label="Email address" required>
        <input
          aria-invalid={Boolean(fieldErrors.email)}
          autoComplete="email"
          className="field"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </FormField>

      <FormField error={fieldErrors.password} htmlFor="login-password" label="Password" required>
        <div className="relative">
          <input
            aria-invalid={Boolean(fieldErrors.password)}
            autoComplete="current-password"
            className="field pr-10"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide entered characters" : "Reveal entered characters"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </FormField>

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <button className="btn-primary w-full" disabled={loading} type="submit">
        {loading ? <LoaderCircle className="animate-spin" size={17} /> : <ArrowRight size={17} />}
        <span>{loading ? "Signing in…" : "Sign in securely"}</span>
      </button>
    </form>
  );
}
