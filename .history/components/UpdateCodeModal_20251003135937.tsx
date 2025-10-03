import { useEffect, useRef, useState } from "react";

type Place = {
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
    if (!code.trim()) return;
    setSaving(true);
    try {
      // Decide whether to submit with place_id or establishment_id
      const payload: any = {
        code: code.trim(),
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      };
      if (place.place_id) payload.place_id = place.place_id;
      if (!place.place_id && place.establishment_id) payload.establishment_id = place.establishment_id;

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error(j.error || (await res.text()) || "Failed to save");
      onSaved?.(code.trim());
      onClose();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save");
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
            onChange={(e) => setCode(e.target.value)}
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
