// components/UpdateCodeModal.tsx
import { useEffect, useRef, useState } from "react";

export type Place = {
  place_id?: string;            // if available (Google)
  establishment_id?: string;    // fallback when no place_id yet
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  code?: string | null;
  code_updated_at?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  place: Place | null;
  onSaved?: (newCode: string) => void;
};

type SubmitPayloadBase = {
  code: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
};

type SubmitPayload =
  | (SubmitPayloadBase & { place_id: string; establishment_id?: never })
  | (SubmitPayloadBase & { establishment_id: string; place_id?: never })
  | (SubmitPayloadBase & { place_id?: never; establishment_id?: never });

export default function UpdateCodeModal({ open, onClose, place, onSaved }: Props) {
  const [code, setCode] = useState(place?.code ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCode(place?.code ?? "");
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    // lock page scroll
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  if (!open || !place) return null;

  async function handleSave() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const base: SubmitPayloadBase = {
        code: trimmed,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      };

      let payload: SubmitPayload = base;
      if (place.place_id) {
        payload = { ...base, place_id: place.place_id };
      } else if (place.establishment_id) {
        payload = { ...base, establishment_id: place.establishment_id };
      }

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let j: { error?: string } | null = null;
      try {
        j = text ? (JSON.parse(text) as { error?: string }) : null;
      } catch {
        // non-JSON response is fine; treat as no structured error
      }

      if (!res.ok || (j && j.error)) {
        throw new Error(j?.error || `Failed to save (HTTP ${res.status})`);
      }

      onSaved?.(trimmed);
      onClose();
    } catch (e: unknown) {
      const err = e as Error;
      alert(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      {/* dialog */}
      <div className="relative z-[201] w-[92vw] max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-100">{place.name}</div>
            <div className="text-xs text-slate-300">{place.address ?? "No address"}</div>
          </div>
          <button
            className="rounded-full p-2 text-slate-300 hover:bg-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-200">Restroom code</label>
          <input
            ref={inputRef}
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            type="tel"
            enterKeyHint="done"
            placeholder="e.g., 2580"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-lg tracking-widest font-mono
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100"
          />
          <p className="mt-2 text-xs text-slate-400">
            Numbers are typical. If there’s an extra step (e.g. “press #”, “ask for key”), include it after the code.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-sm border border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="rounded-lg px-4 py-2 text-sm bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || !code.trim()}
          >
            {saving ? "Saving..." : (place.code ? "Update code" : "Add code")}
          </button>
        </div>
      </div>
    </div>
  );
}
