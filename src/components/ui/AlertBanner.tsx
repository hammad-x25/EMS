"use client";

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  success: "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  error: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

const VARIANT_ICON: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function AlertBanner({
  variant = "info",
  children,
  onDismiss,
  className = "",
  live,
}: {
  variant?: AlertVariant;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
  live?: "polite" | "assertive";
}) {
  const Icon = VARIANT_ICON[variant];
  const role = variant === "error" || live === "assertive" ? "alert" : "status";
  const ariaLive = live ?? (variant === "error" ? "assertive" : "polite");

  return (
    <div
      aria-live={ariaLive}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium ${VARIANT_CLASSES[variant]} ${className}`}
      role={role}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          aria-label="Dismiss message"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-black/10"
          onClick={onDismiss}
          type="button"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
