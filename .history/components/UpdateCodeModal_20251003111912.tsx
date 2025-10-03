// components/UpdateCodeModal.tsx
import { useEffect, useRef, useState } from "react";

type Place = {
  place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  code?: string | null;
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
    // reset code when place changes
    setCode(place?.code ?? "");
  }, [place]);

  useEffect(() => {
    if (open) {
      // slight delay so element exists then focus
      setTimeout(() => inputRef.current?.focus(), 10);
      // prevent body scroll while modal open
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  async function handleSave() {
    if (!place) return;
    if (!code.trim()) return;
    try {
      setSaving(true);
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: place.place_id,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          code: code.trim(),
          staff_verified: false,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Failed to save");
      onSaved?.(code.trim());
      onClose();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !place) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* sheet */}
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[480px] w-full rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{place.name}</div>
            <div className="text-sm text-neutral-600">{place.address ?? "No address"}</div>
          </div>
          <button
            className="rounded-full p-2 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="text-sm text-neutral-700">Restroom code</label>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            inputMode="numeric"      // mobile numeric keypad
            pattern="[0-9]*"
            type="tel"
            enterKeyHint="done"
            placeholder="e.g., 2580"
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-lg tracking-widest font-mono
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Numbers only. If key is also needed (e.g. “Ask barista”), leave a note in the code (e.g. “2580# key”).
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-sm border border-neutral-300 hover:bg-neutral-100"
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
