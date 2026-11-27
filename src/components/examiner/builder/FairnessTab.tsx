"use client";

import { Scale } from "lucide-react";
import type { FairnessSimulationReport } from "@/lib/fairness";

export function FairnessTab({
  busy,
  fairnessReport,
  onRunSimulation,
}: {
  busy: boolean;
  fairnessReport: FairnessSimulationReport | null;
  onRunSimulation: () => void;
}) {
  return (
    <section className="card space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Open Innovation 5.2</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Paper Fairness Variance Inspector</h2>
          <p className="muted mt-1 text-sm">
            Simulates 20 candidate papers using deterministic cryptographic seeds to verify equivalent difficulty and 100% topic coverage.
          </p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={onRunSimulation} type="button">
          <Scale size={17} /> {busy ? "Simulating…" : "Run 20-paper simulation"}
        </button>
      </div>

      {fairnessReport ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Mean Difficulty (1–3)</p>
              <p className="font-mono-tabular mt-1 text-2xl font-extrabold">{fairnessReport.simulatedMeanDifficulty}</p>
            </div>
            <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
              <p className="text-xs font-semibold text-[var(--status-success-text)]">Difficulty Std Dev (σ)</p>
              <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-[var(--status-success-text)]">
                {fairnessReport.difficultyStdDev}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Difficulty Spread</p>
              <p className="font-mono-tabular mt-1 text-2xl font-extrabold">
                {fairnessReport.minDifficultyAvg} – {fairnessReport.maxDifficultyAvg}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4">
              <p className="text-xs font-semibold text-[var(--status-info-text)]">Topic Coverage</p>
              <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-[var(--status-info-text)]">
                {fairnessReport.topicCoveragePercent}%
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {fairnessReport.samplePapers.map((sample) => (
              <div className="rounded-lg border border-[var(--border-subtle)] p-4" key={sample.sampleLabel}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-[var(--text-primary)]">{sample.sampleLabel}</h3>
                  <span className="font-mono-tabular text-xs font-bold text-[var(--accent-primary)]">
                    Avg difficulty: {sample.fairnessDifficultyAvg}
                  </span>
                </div>
                <ul className="mt-3 space-y-2 text-xs">
                  {sample.items.map((item) => (
                    <li
                      className="flex items-center justify-between gap-2 rounded-md bg-[var(--bg-surface-subtle)] px-3 py-2"
                      key={`${sample.sampleLabel}-${item.questionId}`}
                    >
                      <span>
                        <strong>Q{item.displayOrder}</strong> · {item.topic} ({item.difficulty})
                      </span>
                      <span className="font-mono-tabular text-[var(--text-muted)]">
                        {item.optionOrder.length > 0 ? `opts [${item.optionOrder.join(",")}]` : `${item.maxMarks}m written`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--text-secondary)]">
          Save your questions or blueprint rules first, then click &ldquo;Run 20-paper simulation&rdquo; to inspect difficulty variance.
        </p>
      )}
    </section>
  );
}
