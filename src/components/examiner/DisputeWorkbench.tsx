"use client";

import { DisputeStatus } from "@prisma/client";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Scale, ShieldAlert } from "lucide-react";
import type { DisputeDto } from "@/lib/disputes";

type OutcomeChoice = "RESOLVED_UPHELD" | "RESOLVED_ADJUSTED" | "REJECTED";

const STATUS_STYLE: Record<DisputeStatus, string> = {
  OPEN: "bg-amber-50 text-amber-800",
  UNDER_REVIEW: "bg-indigo-50 text-indigo-700",
  RESOLVED_UPHELD: "bg-slate-100 text-slate-700",
  RESOLVED_ADJUSTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
};

export function DisputeWorkbench({ initialDisputes }: { initialDisputes: DisputeDto[] }) {
  const [disputes, setDisputes] = useState<DisputeDto[]>(initialDisputes);
  const [statusFilter, setStatusFilter] = useState<"ALL" | DisputeStatus>("ALL");
  const [activeId, setActiveId] = useState<string | null>(initialDisputes[0]?.id ?? null);

  const [outcome, setOutcome] = useState<OutcomeChoice>("RESOLVED_ADJUSTED");
  const [adjustMode, setAdjustMode] = useState<"manual" | "delta">("delta");
  const [adjustedManualScore, setAdjustedManualScore] = useState("0");
  const [scoreDelta, setScoreDelta] = useState("1");
  const [resolutionNote, setResolutionNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(
    () =>
      disputes.filter((item) => statusFilter === "ALL" || item.status === statusFilter),
    [disputes, statusFilter],
  );

  const selected = useMemo(
    () => filtered.find((item) => item.id === activeId) ?? filtered[0] ?? null,
    [filtered, activeId],
  );

  function selectDispute(item: DisputeDto) {
    setActiveId(item.id);
    setBanner(null);
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
      const body = (await response.json()) as {
        dispute?: DisputeDto;
        error?: { message?: string };
      };
      if (!response.ok || !body.dispute) {
        throw new Error(body.error?.message ?? "Failed to update dispute");
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
      const body = (await response.json()) as {
        dispute?: DisputeDto;
        updatedTotalScore?: number | null;
        verification?: { code: string; version: number } | null;
        error?: { message?: string };
      };
      if (!response.ok || !body.dispute) {
        throw new Error(body.error?.message ?? "Resolution failed");
      }

      setDisputes((current) =>
        current.map((item) => (item.id === body.dispute!.id ? body.dispute! : item)),
      );
      setBanner({
        type: "success",
        text:
          body.verification && body.updatedTotalScore !== null
            ? `Resolved (${body.dispute.status}). Updated score: ${body.updatedTotalScore} / ${body.dispute.attemptMaxScore}. Issued new report verification ${body.verification.code} (v${body.verification.version}); prior report versions superseded.`
            : `Dispute resolved with outcome ${body.dispute.status}.`,
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
        {statuses.map((s) => (
          <button
            className={
              statusFilter === s
                ? "btn-primary px-3 py-1.5 text-xs"
                : "btn-secondary px-3 py-1.5 text-xs"
            }
            key={s}
            onClick={() => setStatusFilter(s)}
            type="button"
          >
            {s === "ALL" ? `All (${disputes.length})` : s.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {banner ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <section className="card divide-y divide-slate-100 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No disputes match this filter.
            </p>
          ) : (
            filtered.map((item) => (
              <button
                className={`block w-full p-4 text-left transition hover:bg-slate-50 ${
                  selected?.id === item.id ? "bg-indigo-50/70" : ""
                }`}
                key={item.id}
                onClick={() => selectDispute(item)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`status-pill ${STATUS_STYLE[item.status]}`}>
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 font-bold text-slate-900">{item.candidate.name}</p>
                <p className="truncate text-xs text-slate-600">{item.examTitle}</p>
                <p className="mt-1 text-xs font-semibold text-indigo-700">{item.category}</p>
              </button>
            ))
          )}
        </section>

        <section className="card p-6">
          {!selected ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Select a dispute from the queue to inspect snapshot evidence and resolve.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="eyebrow">{selected.category}</p>
                  <h2 className="mt-1 text-xl font-black">
                    {selected.candidate.name}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      ({selected.candidate.studentId ?? selected.candidate.email})
                    </span>
                  </h2>
                  <p className="text-sm text-slate-600">
                    {selected.examTitle} · Current total:{" "}
                    <strong>
                      {selected.attemptTotalScore ?? 0} / {selected.attemptMaxScore}
                    </strong>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`status-pill ${STATUS_STYLE[selected.status]}`}>
                    {selected.status.replaceAll("_", " ")}
                  </span>
                  <Link
                    className="btn-secondary px-3 py-1.5 text-xs"
                    href={`/examiner/exams/${selected.examId}/analytics`}
                  >
                    Analytics <ExternalLink size={13} />
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Candidate Statement
                </p>
                <p className="mt-2 text-sm text-slate-900">{selected.description}</p>
              </div>

              {selected.question ? (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                      Snapshot Question {selected.question.displayOrder} · {selected.question.topic} ({selected.question.type})
                    </p>
                    <span className="text-xs font-bold">
                      Earned:{" "}
                      {selected.question.autoScore + (selected.question.manualScore ?? 0)} /{" "}
                      {selected.question.maxMarks}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{selected.question.prompt}</p>
                  {selected.question.writtenText ? (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap">
                      {selected.question.writtenText}
                    </div>
                  ) : selected.question.selectedIds?.length ? (
                    <p className="text-xs text-slate-700">
                      Selected options:{" "}
                      <strong>{selected.question.selectedIds.join(", ").toUpperCase()}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Unanswered</p>
                  )}
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <ShieldAlert size={14} /> Server Incident &amp; Connectivity Timeline (Review Signals)
                </p>
                {selected.events.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No connectivity gaps or behavioral review signals recorded during this attempt.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {selected.events.map((event) => (
                      <li key={event.id}>
                        <span className="font-mono text-slate-500">
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
                  className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"
                  onSubmit={submitResolution}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-black text-slate-900">
                      <Scale size={17} /> Audited Resolution
                    </h3>
                    {selected.status === "OPEN" ? (
                      <button
                        className="btn-secondary px-3 py-1.5 text-xs"
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
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border bg-white p-3 text-xs font-bold ${
                          outcome === opt.value ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
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
                    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                      {selected.question && selected.question.type === "WRITTEN" ? (
                        <label className="text-xs font-bold">
                          Adjustment method
                          <select
                            className="field mt-1"
                            onChange={(e) => setAdjustMode(e.target.value as "manual" | "delta")}
                            value={adjustMode}
                          >
                            <option value="manual">
                              Set written score (0 – {selected.question.maxMarks})
                            </option>
                            <option value="delta">Apply score delta (± marks)</option>
                          </select>
                        </label>
                      ) : null}

                      {adjustMode === "manual" && selected.question ? (
                        <label className="text-xs font-bold">
                          New written score (max {selected.question.maxMarks})
                          <input
                            className="field mt-1"
                            max={selected.question.maxMarks}
                            min={0}
                            onChange={(e) => setAdjustedManualScore(e.target.value)}
                            required
                            step="0.5"
                            type="number"
                            value={adjustedManualScore}
                          />
                        </label>
                      ) : (
                        <label className="text-xs font-bold">
                          Score delta (± marks)
                          <input
                            className="field mt-1"
                            onChange={(e) => setScoreDelta(e.target.value)}
                            required
                            step="0.5"
                            type="number"
                            value={scoreDelta}
                          />
                        </label>
                      )}
                    </div>
                  ) : null}

                  <label className="block text-sm font-bold">
                    Resolution note <span className="font-normal text-slate-500">(visible to candidate &amp; audit log)</span>
                    <textarea
                      className="field mt-1.5 min-h-20"
                      minLength={5}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Document the evidence-based rationale for this resolution..."
                      required
                      value={resolutionNote}
                    />
                  </label>

                  <div className="flex justify-end">
                    <button className="btn-primary" disabled={busy} type="submit">
                      <CheckCircle2 size={16} />
                      {busy ? "Recording resolution…" : "Confirm audited resolution"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="font-bold">
                    Final outcome: {selected.status.replaceAll("_", " ")}
                    {selected.scoreDelta !== null
                      ? ` (${selected.scoreDelta >= 0 ? "+" : ""}${selected.scoreDelta} marks)`
                      : ""}
                  </p>
                  <p className="mt-1">{selected.resolutionNote}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
