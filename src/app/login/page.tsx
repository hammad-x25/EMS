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
    <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center bg-slate-950 p-10 text-white">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 text-lg font-black"><ShieldCheck className="text-indigo-400" /> AegisExam</div>
          <h1 className="mt-12 text-5xl font-black leading-tight">One secure entrance. Three focused workspaces.</h1>
          <p className="mt-6 leading-7 text-slate-300">Sessions are signed, protected from client-side scripts, and checked against current account status on every sensitive action.</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="card w-full max-w-md p-7 md:p-10">
          <p className="eyebrow">Welcome back</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Sign in to your workspace</h2>
          <p className="muted mb-8 mt-2">Use your assigned institutional account.</p>
          <LoginForm demoMode={process.env.NEXT_PUBLIC_DEMO_MODE !== "false"} />
        </div>
      </section>
    </main>
  );
}
