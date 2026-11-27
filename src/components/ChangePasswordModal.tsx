"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { parseApiError, readApiJson } from "@/lib/form-errors";

export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function resetFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNext(false);
    setFieldErrors({});
  }

  function handleClose() {
    if (busy) return;
    resetFields();
    setBanner(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: "New passwords do not match." });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await readApiJson<{ ok?: boolean; error?: { message?: string; details?: unknown } }>(response);
      if (!response.ok || !body?.ok) {
        const parsed = parseApiError(body, "Unable to update password");
        setFieldErrors(parsed.fieldErrors);
        setBanner({ type: "error", text: parsed.formErrors[0] ?? parsed.message });
        return;
      }

      resetFields();
      setBanner({
        type: "success",
        text: "Password updated. Other active sessions have been signed out automatically.",
      });
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to update password",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      closeDisabled={busy}
      closeLabel="Close change password dialog"
      description="Update your account password. All other active devices will be signed out."
      eyebrow="Account security"
      onClose={handleClose}
      open={open}
      size="sm"
      title="Change password"
    >
      <form className="space-y-4" onSubmit={submit}>
        {banner ? (
          <AlertBanner onDismiss={() => setBanner(null)} variant={banner.type}>
            {banner.text}
          </AlertBanner>
        ) : null}

        <FormField
          error={fieldErrors.currentPassword}
          htmlFor="change-current-password"
          label="Current password"
          required
        >
          <div className="relative">
            <input
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              autoComplete="current-password"
              className="field pr-10"
              id="change-current-password"
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
            />
            <button
              aria-label={showCurrent ? "Hide current characters" : "Reveal current characters"}
              aria-pressed={showCurrent}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
              onClick={() => setShowCurrent((v) => !v)}
              type="button"
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <FormField
          error={fieldErrors.newPassword}
          hint="At least 12 characters with upper/lowercase, number, and symbol."
          htmlFor="change-new-password"
          label="New password"
          required
        >
          <div className="relative">
            <input
              aria-invalid={Boolean(fieldErrors.newPassword)}
              autoComplete="new-password"
              className="field pr-10"
              id="change-new-password"
              minLength={12}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              type={showNext ? "text" : "password"}
              value={newPassword}
            />
            <button
              aria-label={showNext ? "Hide new characters" : "Reveal new characters"}
              aria-pressed={showNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
              onClick={() => setShowNext((v) => !v)}
              type="button"
            >
              {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <FormField
          error={fieldErrors.confirmPassword}
          htmlFor="change-confirm-password"
          label="Confirm new password"
          required
        >
          <input
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            autoComplete="new-password"
            className="field"
            id="change-confirm-password"
            minLength={12}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            type={showNext ? "text" : "password"}
            value={confirmPassword}
          />
        </FormField>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <button className="btn-secondary" disabled={busy} onClick={handleClose} type="button">
            Close
          </button>
          <button className="btn-primary" disabled={busy} type="submit">
            <KeyRound size={15} />
            <span>{busy ? "Updating…" : "Update password"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
