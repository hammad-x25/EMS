import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export default async function HomePage() {
  const session = await getSession();
  const destination = session ? roleHome(session.role) : "/login";
  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <nav className="mx-auto flex max-w-6xl items-center justify-between" aria-label="Primary navigation">
        <div className="flex items-center gap-3 font-extrabold"><ShieldCheck className="text-indigo-600" /> AegisExam</div>
        <Link className="btn-secondary" href={destination}>{session ? "Open workspace" : "Sign in"}</Link>
      </nav>
      <section className="mx-auto grid max-w-6xl items-center gap-12 py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="eyebrow">Secure assessment operations</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.05] tracking-tight text-slate-950 md:text-7xl">
            Examinations built for trust, fairness, and continuity.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            AegisExam gives administrators, examiners, and candidates focused workflows backed by server-enforced access control and auditable operations.
          </p>
          <Link className="btn-primary mt-8" href={destination}>Enter AegisExam <ArrowRight size={18} /></Link>
        </div>
        <div className="card relative overflow-hidden p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-indigo-100" />
          <p className="eyebrow relative">Foundation controls</p>
          <ul className="relative mt-8 space-y-5">
            {[
              "Backend-enforced role and account status checks",
              "Protected credentials and production-secure sessions",
              "Immutable audit evidence for sensitive operations",
              "Deterministic test accounts for live evaluation",
            ].map((item) => (
              <li className="flex gap-3 text-slate-700" key={item}><CheckCircle2 className="shrink-0 text-emerald-600" size={21} /> {item}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
