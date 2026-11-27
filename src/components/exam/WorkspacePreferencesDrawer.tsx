"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { WorkspacePreferences } from "@/lib/preferences";

export function WorkspacePreferencesDrawer({
  open,
  preferences,
  onChange,
  onClose,
}: {
  open: boolean;
  preferences: WorkspacePreferences;
  onChange: (patch: Partial<WorkspacePreferences>) => void;
  onClose: () => void;
}) {
  return (
    <Drawer
      closeLabel="Close settings"
      eyebrow="Accessibility & focus"
      maxWidthClass="max-w-md"
      onClose={onClose}
      open={open}
      title="Workspace settings"
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="text-sm font-bold text-[var(--text-primary)]">Font size</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["sm", "md", "lg"] as const).map((value) => (
              <button
                aria-pressed={preferences.fontSize === value}
                className={preferences.fontSize === value ? "btn-primary" : "btn-secondary"}
                key={value}
                onClick={() => onChange({ fontSize: value })}
                type="button"
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-bold text-[var(--text-primary)]">
          Visual theme
          <select
            className="field mt-2"
            onChange={(event) => onChange({ theme: event.target.value as WorkspacePreferences["theme"] })}
            value={preferences.theme}
          >
            <option value="light">Light (Default)</option>
            <option value="dark">Dark (Low Glare)</option>
            <option value="high-contrast">High Contrast (WCAG AAA)</option>
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-bold text-[var(--text-primary)]">Question palette position</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["left", "right"] as const).map((value) => (
              <button
                aria-pressed={preferences.palettePos === value}
                className={preferences.palettePos === value ? "btn-primary" : "btn-secondary"}
                key={value}
                onClick={() => onChange({ palettePos: value })}
                type="button"
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-sm font-semibold text-[var(--text-primary)]">
          <span>Compact spacing</span>
          <input
            checked={preferences.compactMode}
            onChange={(event) => onChange({ compactMode: event.target.checked })}
            type="checkbox"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-sm font-semibold text-[var(--text-primary)]">
          <span>Hide countdown timer</span>
          <input
            checked={preferences.hideTimer}
            onChange={(event) => onChange({ hideTimer: event.target.checked })}
            type="checkbox"
          />
        </label>

        <p className="text-xs leading-5 text-[var(--text-muted)]">
          When the countdown clock is hidden, gentle milestone alerts still announce 5 minutes and 1 minute remaining. Changes save immediately to your account with local browser fallback.
        </p>
      </div>
    </Drawer>
  );
}
