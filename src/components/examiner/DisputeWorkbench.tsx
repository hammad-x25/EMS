"use client";

import { DisputeStatus } from "@prisma/client";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Scale, ShieldAlert } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DisputeDto } from "@/lib/dispute-types";
import { parseApiError, readApiJson } from "@/lib/form-errors";

type OutcomeChoice = "RESOLVED_UPHELD" | "RESOLVED_ADJUSTED" | "REJECTED";

export function DisputeWorkbench({ initialDisputes }: { initialDisputes: DisputeDto[] }) {
  const [disputes, setDisputes] = useState<DisputeDto[]>(initialDisputes);
  const [statusFilter, setStatusFilter] = useState<"ALL" | DisputeStatus>("ALL");
  const [activeId, setActiveId] = useState<string | null>(initialDisputes[0]?.id ?? null);

  const [outcome, setOutcome] = useState<OutcomeChoice>("RESOLVED_ADJUSTED");
  const [adjustMode, setAdjustMode] = useState<"manual" | "delta">("delta");
  const [adjustedManualScore, setAdjustedManualScore] = useState("0");
  const [scoreDelta, setScoreDelta] = useState("1");
  const [resolutionNote, setResolutionNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(
    () => disputes.filter((item) => statusFilter === "ALL" || item.status === statusFilter),
    [disputes, statusFilter],
  );

  const selected = useMemo(
    () => filtered.find((item) => item.id === activeId) ?? filtered[0] ?? null,
    [filtered, activeId],
  );

  function selectDispute(item: DisputeDto) {
    setActiveId(item.id);
    setBanner(null);
    setFieldErrors({});
    setResolutionNote(item.resolutionNote ?? "");
    if (item.question && item.question.type === "WRITTEN") {
      setAdjustMode("manual");
      setAdjustedManualScore(String(item.question.manualScore ?? 0));
    } else {
      setAdjustMode("delta");
      setScoreDelta("1");
    }
  }

  async function markUnderReview(disputeId: string) {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: "UNDER_REVIEW" }),
      });
      const body = await readApiJson<{ dispute?: DisputeDto; error?: { message?: string } }>(response);
      if (!response.ok || !body?.dispute) {
        throw new Error(parseApiError(body, "Failed to update dispute").message);
      }
      setDisputes((current) =>
        current.map((item) => (item.id === body.dispute!.id ? body.dispute! : item)),
      );
      setBanner({ type: "success", text: "Dispute marked as UNDER_REVIEW." });
    } catch (error: unknown) {
      setBanner({
        type: "error",
        text: error instanceof Error ? error.message : "Update failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitResolution(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setBanner(null);
    setFieldErrors({});

    const payload: Record<string, unknown> = {
      outcome,
      resolutionNote,
    };

    if (outcome === "RESOLVED_ADJUSTED") {
      if (adjustMode === "manual" && selected.question) {
        payload.adjustedManualScore = Number(adjustedManualScore);
      } else {
        payload.scoreDelta = Number(scoreDelta);
      }
    }

    try {
      const response = await fetch(`/api/disputes/${selected.id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readApiJson<{
        dispute?: DisputeDto;
        error?: { message?: string; details?: unknown };
      }>(response);
      if (!response.ok || !body?.dispute) {
        const parsed = parseApiError(body, "Resolution failed");
        setFieldErrors(parsed.fieldErrors);
        throw new Error(parsed.formErrors[0] ?? parsed.message);
      }
      setDisputes((current) =>
        current.map((item) => (item.id === body.dispute!.id ? body.dispute! : item)),
      );
      setBanner({
        type: "success",
        text: `Dispute resolved (${body.dispute.status}). Updated score: ${body.dispute.attemptTotalScore ?? 0} / ${body.dispute.attemptMaxScore}. Superseding report issued if a PDF was published.`,
      });
    } catch (error: unknown) {
      setBanner({
        type: "error",
        text: error instanceof Error ? error.message : "Resolution failed",
      });
    } finally {
      setBusy(false);
    }
  }

  const statuses: Array<"ALL" | DisputeStatus> = [
    "ALL",
    "OPEN",
    "UNDER_REVIEW",
    "RESOLVED_ADJUSTED",
    "RESOLVED_UPHELD",
    "REJECTED",
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const count = s === "ALL" ? disputes.length : disputes.filter((d) => d.status === s).length;
          return (
            <button
              className={statusFilter === s ? "btn-primary h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
              key={s}
              onClick={() => setStatusFilter(s)}
              type="button"
            >
              {s === "ALL" ? `All (${count})` : `${s.replaceAll("_", " ")} (${count})`}
            </button>
          );
        })}
      </div>

      {banner ? (
        <AlertBanner onDismiss={() => setBanner(null)} variant={banner.type}>
          {banner.text}
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <section className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              description="Disputes raised by candidates for your examinations appear here."
              icon={Scale}
              title="No matching disputes"
            />
          ) : (
            filtered.map((item) => (
              <button
                className={`block w-full p-4 text-left transition-colors hover:bg-[var(--bg-surface-subtle)] ${
                  selected?.id === item.id ? "bg-[var(--accent-soft)]/70" : ""
                }`}
                key={item.id}
                onClick={() => selectDispute(item)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={item.status} />
                  <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 font-bold text-[var(--text-primary)]">{item.candidate.name}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{item.examTitle}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--accent-primary)]">{item.category}</p>
              </button>
            ))
          )}
        </section>

        <section className="card p-6">
          {!selected ? (
            <EmptyState
              description="Select a dispute from the queue to inspect snapshot evidence and record an audited resolution."
              icon={Scale}
              title="No dispute selected"
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <p className="eyebrow">{selected.category}</p>
                  <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                    {selected.candidate.name}{" "}
                    <span className="font-mono-tabular text-sm font-normal text-[var(--text-secondary)]">
                      ({selected.candidate.studentId ?? selected.candidate.email})
                    </span>
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {selected.examTitle} · Current total:{" "}
                    <strong className="font-mono-tabular text-[var(--text-primary)]">
                      {selected.attemptTotalScore ?? 0} / {selected.attemptMaxScore}
                    </strong>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <Link className="btn-secondary h-9 px-3 text-xs" href={`/examiner/exams/${selected.examId}/analytics`}>
                    Analytics <ExternalLink size={13} />
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Candidate Statement
                </p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{selected.description}</p>
              </div>

              {selected.question ? (
                <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="eyebrow">
                      Snapshot Question {selected.question.displayOrder} · {selected.question.topic} ({selected.question.type})
                    </p>
                    <span className="font-mono-tabular text-xs font-bold">
                      Earned: {selected.question.autoScore + (selected.question.manualScore ?? 0)} /{" "}
                      {selected.question.maxMarks}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.question.prompt}</p>
                  {selected.question.writtenText ? (
                    <div className="whitespace-pre-wrap rounded-md bg-[var(--bg-surface-subtle)] p-3 text-xs">
                      {selected.question.writtenText}
                    </div>
                  ) : selected.question.selectedIds?.length ? (
                    <p className="text-xs text-[var(--text-secondary)]">
                      Selected options:{" "}
                      <strong className="font-mono-tabular">
                        {selected.question.selectedIds.join(", ").toUpperCase()}
                      </strong>
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Unanswered</p>
                  )}
                </div>
              ) : null}

              <div className="rounded-lg border border-[var(--border-subtle)] p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  <ShieldAlert size={14} /> Server Incident &amp; Connectivity Timeline (Review Signals)
                </p>
                {selected.events.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    No connectivity gaps or behavioral review signals recorded during this attempt.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    {selected.events.map((event) => (
                      <li key={event.id}>
                        <span className="font-mono-tabular text-[var(--text-muted)]">
                          {new Date(event.occurredAt).toLocaleTimeString()}
                        </span>{" "}
                        · <strong>{event.eventType}</strong> ({event.severity})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.status === "OPEN" || selected.status === "UNDER_REVIEW" ? (
                <form
                  className="space-y-4 rounded-lg border border-[var(--accent-soft-border)] bg-[var(--accent-soft)]/40 p-5"
                  onSubmit={submitResolution}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                      <Scale size={17} /> Audited Resolution
                    </h3>
                    {selected.status === "OPEN" ? (
                      <button
                        className="btn-secondary h-9 px-3 text-xs"
                        disabled={busy}
                        onClick={() => void markUnderReview(selected.id)}
                        type="button"
                      >
                        <Clock size={14} /> Mark under review
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        { value: "RESOLVED_ADJUSTED", label: "Adjust Score & Re-issue Report" },
                        { value: "RESOLVED_UPHELD", label: "Uphold Original Grade" },
                        { value: "REJECTED", label: "Reject Dispute" },
                      ] as const
                    ).map((opt) => (
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-bold ${
                          outcome === opt.value
                            ? "border-[var(--accent-primary)] bg-[var(--bg-surface)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                        }`}
                        key={opt.value}
                      >
                        <input
                          checked={outcome === opt.value}
                          name="outcome"
                          onChange={() => setOutcome(opt.value)}
                          type="radio"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  {outcome === "RESOLVED_ADJUSTED" ? (
                    <div className="grid gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 md:grid-cols-2">
                      {selected.question && selected.question.type === "WRITTEN" ? (
                        <FormField label="Adjustment method">
                          <select
                            className="field"
                            onChange={(e) => setAdjustMode(e.target.value as "manual" | "delta")}
                            value={adjustMode}
                          >
                            <option value="manual">Set written score (0 – {selected.question.maxMarks})</option>
                            <option value="delta">Apply score delta (± marks)</option>
                          </select>
                        </FormField>
                      ) : null}

                      {adjustMode === "manual" && selected.question ? (
                        <FormField
                          error={fieldErrors.adjustedManualScore}
                          label={`New written score (max ${selected.question.maxMarks})`}
                          required
                        >
                          <input
                            aria-invalid={Boolean(fieldErrors.adjustedManualScore)}
                            className="field font-mono-tabular"
                            max={selected.question.maxMarks}
                            min={0}
                            onChange={(e) => setAdjustedManualScore(e.target.value)}
                            required
                            step="0.5"
                            type="number"
                            value={adjustedManualScore}
                          />
                        </FormField>
                      ) : (
                        <FormField error={fieldErrors.scoreDelta} label="Score delta (± marks)" required>
                          <input
                            aria-invalid={Boolean(fieldErrors.scoreDelta)}
                            className="field font-mono-tabular"
                            onChange={(e) => setScoreDelta(e.target.value)}
                            required
                            step="0.5"
                            type="number"
                            value={scoreDelta}
                          />
                        </FormField>
                      )}
                    </div>
                  ) : null}

                  <FormField
                    error={fieldErrors.resolutionNote}
                    hint="Visible to candidate and recorded permanently in the audit log."
                    label="Resolution note"
                    required
                  >
                    <textarea
                      aria-invalid={Boolean(fieldErrors.resolutionNote)}
                      className="field min-h-20"
                      minLength={5}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Document the evidence-based rationale for this resolution..."
                      required
                      value={resolutionNote}
                    />
                  </FormField>

                  <div className="flex justify-end">
                    <button className="btn-primary" disabled={busy} type="submit">
                      <CheckCircle2 size={16} />
                      <span>{busy ? "Recording resolution…" : "Confirm audited resolution"}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <AlertBanner variant="success">
                  <p className="font-bold">
                    Final outcome: {selected.status.replaceAll("_", " ")}
                    {selected.scoreDelta !== null
                      ? ` (${selected.scoreDelta >= 0 ? "+" : ""}${selected.scoreDelta} marks)`
                      : ""}
                  </p>
                  <p className="mt-1 font-normal">{selected.resolutionNote}</p>
                </AlertBanner>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
