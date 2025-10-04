// components/UpdateCodeModal.tsx
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
  onSaved?: (newCodeOrFlag: string) => void;
};

export default function UpdateCodeModal({ open, onClose, place, onSaved }: Props) {
  const [code, setCode] = useState<string>(place?.code ?? "");
  const [openAccess, setOpenAccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset fields when the place changes
  useEffect(() => {
    setCode(place?.code ?? "");
    setOpenAccess(false);
  }, [place]);

  // Focus + scroll lock when open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  // If not open or no place, render nothing (prevents null access)
  if (!open || !place) return null;

  // Narrowed non-null reference for use in handlers
  const p: Place = place;

  async function handleSave() {
    // If "Open access" is checked, we skip code validation & save the flag
    const payload:
      | {
          establishment_id?: string;
          place_id?: string;
          name: string;
          address: string | null;
          lat: number;
          lng: number;
          open_access: true;
          staff_verified?: boolean;
        }
      | {
          establishment_id?: string;
          place_id?: string;
          name: string;
          address: string | null;
          lat: number;
          lng: number;
          code: string;
          open_access?: false;
          staff_verified?: boolean;
        } = openAccess
      ? {
          establishment_id: p.establishment_id,
          place_id: p.place_id,
          name: p.name,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          open_access: true,
        }
      : {
          establishment_id: p.establishment_id,
          place_id: p.place_id,
          name: p.name,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          code: code.trim(),
        };

    if (!openAccess && (!("code" in payload) || payload.code.length === 0)) {
      // require a code when not in open access mode
      inputRef.current?.focus();
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        const errMsg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error?: string }).error ?? "Failed to save")
            : `Failed to save (${res.status})`;
        throw new Error(errMsg);
      }

      // Notify parent
      if (openAccess) {
        onSaved?.("open_access");
      } else {
        onSaved?.(code.trim());
      }
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      alert(msg);
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
            <div className="text-base font-semibold text-slate-100">{p.name}</div>
            <div className="text-xs text-slate-300">{p.address ?? "No address"}</div>
          </div>
          <button
            className="rounded-full p-2 text-slate-300 hover:bg-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={openAccess}
              onChange={(e) => setOpenAccess(e.target.checked)}
            />
            This restroom is open access (no code required)
          </label>

          {!openAccess && (
            <>
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
              <p className="text-xs text-slate-400">
                If there’s an extra step (e.g. “press #”, “ask for key”), include it after the code.
              </p>
            </>
          )}
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
            disabled={saving || (!openAccess && code.trim().length === 0)}
          >
            {saving ? "Saving..." : openAccess ? "Save" : p.code ? "Update code" : "Add code"}
          </button>
        </div>
      </div>
    </div>
  );
}
