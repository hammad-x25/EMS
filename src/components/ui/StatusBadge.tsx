import {
  CheckCircle2,
  Clock,
  FileEdit,
  Lock,
  PlayCircle,
  Radio,
  Scale,
  ShieldAlert,
  UserCheck,
  UserX,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  success: "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  danger: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

interface StatusConfig {
  label: string;
  tone: BadgeTone;
  icon: typeof Clock;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: FileEdit },
  PUBLISHED: { label: "Published", tone: "info", icon: CheckCircle2 },
  ONGOING: { label: "Ongoing", tone: "success", icon: Radio },
  COMPLETED: { label: "Completed", tone: "warning", icon: Lock },
  AVAILABLE: { label: "Available", tone: "success", icon: PlayCircle },
  RESUME: { label: "In Progress", tone: "info", icon: PlayCircle },
  UPCOMING: { label: "Scheduled", tone: "info", icon: Clock },
  ACTIVE: { label: "Active", tone: "success", icon: UserCheck },
  INACTIVE: { label: "Inactive", tone: "danger", icon: UserX },
  ONLINE: { label: "Online", tone: "success", icon: Wifi },
  GAP: { label: "Gap", tone: "warning", icon: WifiOff },
  IN_PROGRESS: { label: "In Progress", tone: "info", icon: PlayCircle },
  SUBMITTED: { label: "Submitted", tone: "success", icon: CheckCircle2 },
  TIMED_OUT: { label: "Timed Out", tone: "warning", icon: Clock },
  GRADED: { label: "Graded", tone: "info", icon: CheckCircle2 },
  OPEN: { label: "Open", tone: "warning", icon: ShieldAlert },
  UNDER_REVIEW: { label: "Under Review", tone: "info", icon: Scale },
  RESOLVED_UPHELD: { label: "Upheld", tone: "neutral", icon: CheckCircle2 },
  RESOLVED_ADJUSTED: { label: "Adjusted", tone: "success", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", tone: "danger", icon: XCircle },
  EASY: { label: "Easy", tone: "success", icon: CheckCircle2 },
  MEDIUM: { label: "Medium", tone: "warning", icon: Clock },
  HARD: { label: "Hard", tone: "danger", icon: ShieldAlert },
};

export function StatusBadge({
  status,
  label,
  tone,
  className = "",
}: {
  status: string;
  label?: string;
  tone?: BadgeTone;
  className?: string;
}) {
  const mapped = STATUS_MAP[status];
  const resolvedTone = tone ?? mapped?.tone ?? "neutral";
  const resolvedLabel = label ?? mapped?.label ?? status.replaceAll("_", " ");
  const Icon = mapped?.icon ?? Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 ${TONE_CLASS[resolvedTone]} ${className}`}
    >
      <Icon aria-hidden="true" size={12} />
      <span>{resolvedLabel}</span>
    </span>
  );
}
