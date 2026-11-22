// components/ProSettingsToggles.tsx
// WHAT IT'S FOR: the on/off toggles on the pro settings page. Each one saves straight away with
// PATCH /api/pro/settings and shows "Saving…", "Saved" or an error. For now there is one toggle:
// "Let other pros book for me". More pro settings can be added to the same list.
// WHO USES IT: app/pro/settings/page.tsx.
// WHY THE NAME: the pro settings toggles; ".tsx" = screen code.

"use client";

import { useState } from "react";

type Settings = { allowOthersToBook: boolean };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

// The toggles shown, in order: the setting's key, its label and a one-line explanation.
const TOGGLES: Array<{ key: keyof Settings; label: string; help: string }> = [
  {
    key: "allowOthersToBook",
    label: "Let other pros book for me",
    help: "When a client calls the shop, other pros here can book them onto your calendar.",
  },
];

export default function ProSettingsToggles({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // Flips one toggle and saves it. If saving fails, the toggle goes back.
  async function flip(key: keyof Settings) {
    const before = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/api/pro/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
        setSettings(before);
        return setSave({ kind: "error", message: body.error?.message ?? "Couldn't save. Try again." });
      }
      setSave({ kind: "saved" });
    } catch {
      setSettings(before);
      setSave({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <div>
      <ul className="!list-none !p-0 grid gap-2">
        {TOGGLES.map((t) => (
          <li key={t.key} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-bg p-3">
            <span>
              <span id={`${t.key}-label`} className="block font-semibold text-text">
                {t.label}
              </span>
              <span className="block text-sm">{t.help}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings[t.key]}
              aria-labelledby={`${t.key}-label`}
              disabled={save.kind === "saving"}
              onClick={() => void flip(t.key)}
              className={`shrink-0 ${settings[t.key] ? "!bg-text !text-bg" : ""}`}
            >
              {settings[t.key] ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="!mb-0 text-sm">
        {save.kind === "saving" ? "Saving…" : save.kind === "saved" ? "Saved." : ""}
      </p>
      {save.kind === "error" && (
        <p role="alert" className="!mt-0 text-sm text-text">
          {save.message}
        </p>
      )}
    </div>
  );
}
