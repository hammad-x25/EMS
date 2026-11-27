import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export default async function HomePage() {
  const session = await getSession();
  const destination = session ? roleHome(session.role) : "/login";

  return (
    <main className="min-h-screen px-6 py-8 md:px-12">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-2.5 text-base font-bold text-[var(--text-primary)]">
          <ShieldCheck aria-hidden="true" className="text-[var(--accent-primary)]" size={22} />
          <span>AegisExam</span>
        </div>
        <Link className="btn-secondary" href={destination}>
          {session ? "Open workspace" : "Sign in"}
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-start gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <div>
          <p className="eyebrow">Institutional examination operations</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-4xl">
            High-stakes examinations built for fairness, continuity, and auditability.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
            AegisExam equips administrators, examiners, and candidates with focused, accessible workflows backed by server-enforced access control, offline answer queuing, and tamper-evident reports.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link className="btn-primary" href={destination}>
              <span>{session ? "Go to workspace" : "Enter AegisExam"}</span>
              <ArrowRight size={17} />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
              <Lock aria-hidden="true" size={14} /> Session-protected institutional access
            </span>
          </div>
        </div>

        <aside aria-label="Platform assurance guarantees" className="card p-6">
          <p className="eyebrow">Operational controls</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">Verification &amp; integrity standards</h2>
          <ul className="mt-5 space-y-3.5">
            {[
              "Backend-enforced role authorization and active account verification",
              "Immutable attempt snapshots, server deadlines, and monotonic sync queues",
              "Stratified difficulty fairness blueprints with zero answer-key leakage",
              "Audited grading, dispute resolution, and QR-verified score reports",
            ].map((item) => (
              <li className="flex items-start gap-2.5 text-sm leading-6 text-[var(--text-secondary)]" key={item}>
                <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--status-success-text)]" size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
