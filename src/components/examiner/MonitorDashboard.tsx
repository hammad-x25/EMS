"use client";

import { FormEvent, useEffect, useState } from "react";
import { BellRing, Clock3, Radio, ShieldAlert, Wifi, WifiOff, X } from "lucide-react";
import type { MonitorAttemptDto, MonitorSnapshotDto } from "@/lib/monitoring";

export function MonitorDashboard({ examId, initialSnapshot }: { examId: string; initialSnapshot: MonitorSnapshotDto }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selected, setSelected] = useState<MonitorAttemptDto | null>(null);
  const [message, setMessage] = useState("");
  const [minutes, setMinutes] = useState(2);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/exams/${examId}/stream`);
    const refresh = (event: MessageEvent<string>) => {
      const next = JSON.parse(event.data) as MonitorSnapshotDto;
      setSnapshot(next);
      setSelected((current) => current ? next.attempts.find((attempt) => attempt.id === current.id) ?? null : null);
    };
    source.addEventListener("SNAPSHOT", refresh as EventListener);
    source.addEventListener("ANNOUNCEMENT", () => setNotice("Announcement delivered to active candidates."));
    source.addEventListener("ATTEMPT_SUBMITTED", () => setNotice("A candidate finalized an attempt."));
    source.onerror = () => setNotice("Live stream reconnecting; 5-second snapshot polling remains active.");
    return () => source.close();
  }, [examId]);

  async function announce(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/exams/${examId}/announcements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setBusy(false);
    if (!response.ok) return setNotice(body?.error?.message ?? "Announcement failed");
    setMessage("");
    setNotice("Announcement broadcast successfully.");
  }

  async function extend(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const response = await fetch(`/api/attempts/${selected.id}/extend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minutes, justification }) });
    const body = await response.json().catch(() => null) as { error?: { message?: string }; extension?: { effectiveDeadlineAt: string; timeExtensionMinutes: number } } | null;
    setBusy(false);
    if (!response.ok) return setNotice(body?.error?.message ?? "Extension failed");
    setJustification("");
    setNotice(`Extension granted. New deadline: ${new Date(body!.extension!.effectiveDeadlineAt).toLocaleTimeString()}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Live examination monitoring</p><h1 className="mt-1 text-3xl font-black">{snapshot.title}</h1><p className="muted mt-1 text-sm">Server snapshot: {new Date(snapshot.serverNow).toLocaleTimeString()}</p></div><span className="status-pill bg-emerald-50 text-emerald-700"><Radio className="animate-pulse" size={14} /> SSE live + 5s DB fallback</span></header>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Review signals only:</strong> Monitoring indicators do not constitute conclusive proof of misconduct and never auto-fail a candidate.</div>
      {notice ? <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900" role="status">{notice}</div> : null}
      <form className="card flex flex-wrap items-end gap-3 p-5" onSubmit={announce}><label className="min-w-64 flex-1 text-sm font-black">Live announcement<input className="field mt-2" maxLength={500} onChange={(event) => setMessage(event.target.value)} placeholder="Send an update to every active workspace…" required value={message} /></label><button className="btn-primary" disabled={busy} type="submit"><BellRing size={16} /> Broadcast</button></form>
      <section className="card overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">Candidate activity ({snapshot.attempts.length})</h2></div><div className="desktop-table"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Candidate</th><th className="p-3">Progress</th><th className="p-3">Connection</th><th className="p-3">Effective deadline</th><th className="p-3">Signals</th><th className="p-3"></th></tr></thead><tbody>{snapshot.attempts.map((attempt) => <tr className="border-t border-slate-100" key={attempt.id}><td className="p-3"><p className="font-bold">{attempt.candidate.name}</p><p className="text-xs text-slate-500">{attempt.candidate.studentId ?? "No student ID"}</p></td><td className="p-3 font-semibold">{attempt.answered}/{attempt.totalQuestions} answered</td><td className="p-3">{attempt.connection === "ONLINE" ? <span className="status-pill bg-emerald-50 text-emerald-700"><Wifi size={13} /> Online</span> : attempt.connection === "GAP" ? <span className="status-pill bg-amber-50 text-amber-800"><WifiOff size={13} /> Gap {attempt.gapSeconds}s</span> : <span className="status-pill bg-slate-100 text-slate-700">{attempt.status}</span>}</td><td className="p-3 text-xs"><Clock3 className="mr-1 inline" size={13} />{new Date(attempt.effectiveDeadlineAt).toLocaleString()}{attempt.timeExtensionMinutes ? <span className="ml-1 font-bold text-indigo-700">(+{attempt.timeExtensionMinutes}m)</span> : null}</td><td className="p-3"><span className="status-pill bg-amber-50 text-amber-800"><ShieldAlert size={13} /> {attempt.incidentCount}</span></td><td className="p-3 text-right"><button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setSelected(attempt)} type="button">Inspect</button></td></tr>)}</tbody></table>{snapshot.attempts.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No real attempts have started.</p> : null}</div></section>
      {selected ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true"><aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><p className="eyebrow">Incident timeline</p><h2 className="mt-1 text-xl font-black">{selected.candidate.name}</h2></div><button aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setSelected(null)} type="button"><X /></button></div><div className="mt-6 space-y-3">{selected.events.map((event) => <article className="rounded-xl border border-slate-200 p-3" key={event.id}><div className="flex items-center justify-between"><strong className="text-sm">{event.eventType.replaceAll("_", " ")}</strong><span className="text-xs text-slate-500">{new Date(event.occurredAt).toLocaleString()}</span></div><pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{event.metadata ? JSON.stringify(event.metadata, null, 2) : "No metadata"}</pre></article>)}{selected.events.length === 0 ? <p className="text-sm text-slate-500">No review signals recorded.</p> : null}</div><form className="mt-8 space-y-3 border-t border-slate-200 pt-5" onSubmit={extend}><h3 className="font-black">Audited outage accommodation</h3><p className="text-xs text-slate-500">Requires a recorded HEARTBEAT LOST event. The original hard deadline is retained.</p><label className="block text-sm font-bold">Additional minutes<input className="field mt-1" max={120} min={1} onChange={(event) => setMinutes(Number(event.target.value))} type="number" value={minutes} /></label><label className="block text-sm font-bold">Required justification<textarea className="field mt-1 min-h-24" minLength={10} onChange={(event) => setJustification(event.target.value)} required value={justification} /></label><button className="btn-primary w-full" disabled={busy || selected.connection !== "GAP"} type="submit">Grant audited extension</button></form></aside></div> : null}
    </div>
  );
}
