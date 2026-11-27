import { X } from "lucide-react";
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-labelledby="workspace-settings-title">
      <section className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Accessibility &amp; focus</p>
            <h2 className="mt-1 text-xl font-black" id="workspace-settings-title">Workspace settings</h2>
          </div>
          <button aria-label="Close settings" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose} type="button"><X size={20} /></button>
        </div>
        <div className="mt-7 space-y-6">
          <fieldset>
            <legend className="text-sm font-black">Font size</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["sm", "md", "lg"] as const).map((value) => (
                <button className={preferences.fontSize === value ? "btn-primary" : "btn-secondary"} key={value} onClick={() => onChange({ fontSize: value })} type="button">{value.toUpperCase()}</button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-black">Theme
            <select className="field mt-2" onChange={(event) => onChange({ theme: event.target.value as WorkspacePreferences["theme"] })} value={preferences.theme}>
              <option value="light">Light</option><option value="dark">Dark</option><option value="high-contrast">High contrast</option>
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-black">Question palette position</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["left", "right"] as const).map((value) => (
                <button className={preferences.palettePos === value ? "btn-primary" : "btn-secondary"} key={value} onClick={() => onChange({ palettePos: value })} type="button">{value[0].toUpperCase() + value.slice(1)}</button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold">
            Compact spacing <input checked={preferences.compactMode} onChange={(event) => onChange({ compactMode: event.target.checked })} type="checkbox" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold">
            Hide countdown timer <input checked={preferences.hideTimer} onChange={(event) => onChange({ hideTimer: event.target.checked })} type="checkbox" />
          </label>
          <p className="text-xs text-slate-500">Changes save immediately to your account, with a browser fallback for interrupted connections.</p>
        </div>
      </section>
    </div>
  );
}
