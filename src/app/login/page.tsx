import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(roleHome(session.role));

  return (
    <main className="grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
      <section className="flex flex-col justify-between bg-slate-950 p-8 text-slate-100 md:p-12">
        <div className="flex items-center gap-2.5 text-lg font-bold">
          <ShieldCheck aria-hidden="true" className="text-indigo-400" size={22} />
          <span>AegisExam</span>
        </div>
        <div className="my-10 max-w-md">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Institutional Portal</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white md:text-4xl">
            One secure entrance. Three role-isolated workspaces.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Authentication tokens are httpOnly, strict same-site, versioned for immediate revocation, and verified against account status on every request.
          </p>
        </div>
        <p className="text-xs text-slate-400">Protected institutional examination delivery system</p>
      </section>

      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="card w-full max-w-md p-6 md:p-8">
          <p className="eyebrow">Account access</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Sign in to your workspace</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Use your assigned institutional credentials.</p>
          <div className="mt-6">
            <LoginForm demoMode={process.env.NEXT_PUBLIC_DEMO_MODE === "true"} />
          </div>
        </div>
      </section>
    </main>
  );
}
