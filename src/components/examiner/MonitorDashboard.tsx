"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BellRing, Clock3, Radio, ShieldAlert } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DataTableToolbar } from "@/components/ui/DataTableControls";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parseApiError, readApiJson } from "@/lib/form-errors";
import type { MonitorAttemptDto, MonitorSnapshotDto } from "@/lib/monitoring";

type MonitorFilter = "ALL" | "ONLINE" | "GAP" | "FLAGGED" | "FINISHED";

export function MonitorDashboard({
  examId,
  initialSnapshot,
}: {
  examId: string;
  initialSnapshot: MonitorSnapshotDto;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selected, setSelected] = useState<MonitorAttemptDto | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MonitorFilter>("ALL");
  const [message, setMessage] = useState("");
  const [minutes, setMinutes] = useState(2);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/exams/${examId}/stream`);
    const refresh = (event: MessageEvent<string>) => {
      const next = JSON.parse(event.data) as MonitorSnapshotDto;
      setSnapshot(next);
      setSelected((current) => (current ? next.attempts.find((attempt) => attempt.id === current.id) ?? null : null));
    };
    source.addEventListener("SNAPSHOT", refresh as EventListener);
    source.addEventListener("ANNOUNCEMENT", () =>
      setNotice({ type: "success", text: "Announcement delivered to active candidates." }),
    );
    source.addEventListener("ATTEMPT_SUBMITTED", () =>
      setNotice({ type: "info", text: "A candidate finalized an attempt." }),
    );
    source.onerror = () =>
      setNotice({ type: "info", text: "Live stream reconnecting; 5-second snapshot polling remains active." });
    return () => source.close();
  }, [examId]);

  const filteredAttempts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.attempts.filter((attempt) => {
      const matchesSearch =
        !q ||
        `${attempt.candidate.name} ${attempt.candidate.studentId ?? ""}`.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter === "ONLINE") return attempt.connection === "ONLINE";
      if (filter === "GAP") return attempt.connection === "GAP";
      if (filter === "FLAGGED") return attempt.incidentCount > 0;
      if (filter === "FINISHED") return attempt.status !== "IN_PROGRESS";
      return true;
    });
  }, [snapshot.attempts, search, filter]);

  async function announce(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/exams/${examId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const body = await readApiJson<{ error?: { message?: string } }>(response);
    setBusy(false);
    if (!response.ok) {
      setNotice({ type: "error", text: parseApiError(body, "Announcement failed").message });
      return;
    }
    setMessage("");
    setNotice({ type: "success", text: "Announcement broadcast successfully." });
  }

  async function extend(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/attempts/${selected.id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes, justification }),
    });
    const body = await readApiJson<{
      error?: { message?: string };
      extension?: { effectiveDeadlineAt: string; timeExtensionMinutes: number };
    }>(response);
    setBusy(false);
    if (!response.ok || !body?.extension) {
      setNotice({ type: "error", text: parseApiError(body, "Extension failed").message });
      return;
    }
    setJustification("");
    setNotice({
      type: "success",
      text: `Extension granted. New deadline: ${new Date(body.extension.effectiveDeadlineAt).toLocaleTimeString()}`,
    });
  }

  const hasHeartbeatLost = Boolean(selected?.events.some((event) => event.eventType === "HEARTBEAT_LOST"));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Examinations", href: "/examiner/exams" },
          { label: snapshot.title, href: `/examiner/exams/${examId}` },
          { label: "Live Monitor" },
        ]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Live examination monitoring</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
            {snapshot.title}
          </h1>
          <p className="font-mono-tabular muted mt-1 text-xs">
            Server snapshot: {new Date(snapshot.serverNow).toLocaleTimeString()}
          </p>
        </div>
        <span className="status-pill border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
          <Radio className="animate-pulse" size={13} /> SSE live + 5s DB fallback
        </span>
      </header>

      <AlertBanner variant="warning">
        <strong>Review signals only:</strong> Monitoring indicators do not constitute conclusive proof of misconduct and never auto-fail a candidate.
      </AlertBanner>

      {notice ? (
        <AlertBanner onDismiss={() => setNotice(null)} variant={notice.type}>
          {notice.text}
        </AlertBanner>
      ) : null}

      <form className="card flex flex-wrap items-end gap-3 p-5" onSubmit={announce}>
        <label className="min-w-64 flex-1 text-sm font-semibold text-[var(--text-primary)]">
          Live announcement
          <input
            className="field mt-1.5"
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Send an update to every active workspace…"
            required
            value={message}
          />
        </label>
        <button className="btn-primary" disabled={busy} type="submit">
          <BellRing size={16} /> Broadcast
        </button>
      </form>

      <DataTableToolbar
        filters={
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["ALL", `All (${snapshot.attempts.length})`],
                ["ONLINE", "Online"],
                ["GAP", "Connection Gap"],
                ["FLAGGED", "Has Signals"],
                ["FINISHED", "Submitted"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={filter === value ? "btn-primary h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        }
        onSearchChange={setSearch}
        search={search}
        searchLabel="Search monitored candidates"
        searchPlaceholder="Search candidate name or student ID"
      />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            Candidate activity ({filteredAttempts.length} of {snapshot.attempts.length})
          </h2>
        </div>

        {filteredAttempts.length === 0 ? (
          <EmptyState
            description={
              snapshot.attempts.length === 0
                ? "Real candidate attempts appear here once candidates enter the workspace (sandbox excluded)."
                : "No candidates match the current search or connection filter."
            }
            icon={Radio}
            title={snapshot.attempts.length === 0 ? "No active attempts yet" : "No matching candidates"}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-[var(--bg-surface-subtle)] text-xs font-bold uppercase text-[var(--text-secondary)] md:table-header-group">
              <tr>
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Progress</th>
                <th className="p-3.5">Connection</th>
                <th className="p-3.5">Effective deadline</th>
                <th className="p-3.5">Signals</th>
                <th className="p-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] md:divide-y-0">
              {filteredAttempts.map((attempt) => (
                <tr className="block space-y-2 p-4 md:table-row md:space-y-0 md:border-t md:border-[var(--border-subtle)] md:p-0" key={attempt.id}>
                  <td className="block md:table-cell md:p-3.5">
                    <p className="font-semibold text-[var(--text-primary)]">{attempt.candidate.name}</p>
                    <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                      {attempt.candidate.studentId ?? "No student ID"}
                    </p>
                  </td>
                  <td className="font-mono-tabular block font-semibold md:table-cell md:p-3.5">
                    {attempt.answered}/{attempt.totalQuestions} answered
                  </td>
                  <td className="inline-block pr-2 md:table-cell md:p-3.5">
                    {attempt.connection === "ONLINE" ? (
                      <StatusBadge label="Online" status="ONLINE" />
                    ) : attempt.connection === "GAP" ? (
                      <StatusBadge label={`Gap ${attempt.gapSeconds}s`} status="GAP" />
                    ) : (
                      <StatusBadge status={attempt.status} />
                    )}
                  </td>
                  <td className="font-mono-tabular block text-xs md:table-cell md:p-3.5">
                    <Clock3 aria-hidden="true" className="mr-1 inline" size={13} />
                    {new Date(attempt.effectiveDeadlineAt).toLocaleString()}
                    {attempt.timeExtensionMinutes ? (
                      <span className="ml-1 font-bold text-[var(--accent-primary)]">
                        (+{attempt.timeExtensionMinutes}m)
                      </span>
                    ) : null}
                  </td>
                  <td className="inline-block md:table-cell md:p-3.5">
                    <span className="status-pill border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
                      <ShieldAlert aria-hidden="true" size={13} /> {attempt.incidentCount}
                    </span>
                  </td>
                  <td className="block text-right md:table-cell md:p-3.5">
                    <button
                      className="btn-secondary h-9 px-3 text-xs"
                      onClick={() => setSelected(attempt)}
                      type="button"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Drawer
        closeLabel="Close candidate inspector"
        eyebrow="Incident timeline"
        maxWidthClass="max-w-xl"
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected?.candidate.name ?? "Candidate details"}
      >
        {selected ? (
          <div className="space-y-6">
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Recorded review signals ({selected.events.length})
              </h3>
              {selected.events.map((event) => (
                <article className="rounded-lg border border-[var(--border-subtle)] p-3" key={event.id}>
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-[var(--text-primary)]">
                      {event.eventType.replaceAll("_", " ")}
                    </strong>
                    <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                      {new Date(event.occurredAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="font-mono-tabular mt-2 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                    {event.metadata ? JSON.stringify(event.metadata, null, 2) : "No metadata"}
                  </pre>
                </article>
              ))}
              {selected.events.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No review signals recorded.</p>
              ) : null}
            </div>

            <form className="space-y-4 border-t border-[var(--border-subtle)] pt-5" onSubmit={extend}>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Audited outage accommodation</h3>
                <p className="muted mt-1 text-xs">
                  Requires an active connectivity gap (<code>HEARTBEAT_LOST</code> event). The original hard deadline is retained for auditability.
                </p>
              </div>

              {selected.connection !== "GAP" ? (
                <AlertBanner variant="info">
                  Extension button is locked because this candidate is currently{" "}
                  <strong>{selected.connection}</strong>
                  {!hasHeartbeatLost ? " with no recorded HEARTBEAT_LOST outage." : "."}
                </AlertBanner>
              ) : null}

              <FormField label="Additional minutes" required>
                <input
                  className="field font-mono-tabular"
                  max={120}
                  min={1}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                  type="number"
                  value={minutes}
                />
              </FormField>

              <FormField hint="Minimum 10 characters; logged permanently in AuditLog." label="Required justification" required>
                <textarea
                  className="field min-h-24"
                  minLength={10}
                  onChange={(event) => setJustification(event.target.value)}
                  required
                  value={justification}
                />
              </FormField>

              <button className="btn-primary w-full" disabled={busy || selected.connection !== "GAP"} type="submit">
                {busy ? "Granting extension…" : "Grant audited extension"}
              </button>
            </form>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
