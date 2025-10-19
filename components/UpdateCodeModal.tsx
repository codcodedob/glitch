// components/UpdateCodeModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowser();

export type Candidate = {
  place_id?: string;
  establishment_id?: string;
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
  place: Candidate | null;
  onSaved?: (newCode: string | null, flags?: { openAccess?: boolean }) => void;
};

export default function UpdateCodeModal({ open, onClose, place, onSaved }: Props) {
  const [code, setCode] = useState("");
  const [openAccess, setOpenAccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabled = saving || (!openAccess && code.trim().length === 0) || !place;

  useEffect(() => {
    if (open) {
      setCode(place?.code ?? "");
      setOpenAccess(false);
    }
  }, [open, place?.code]);

  const title = useMemo(
    () => (place ? `Update: ${place.name}` : "Update bathroom"),
    [place]
  );

  async function handleSave() {
    if (!place) return;
    if (!supabase) {
      alert("Supabase is not configured on the client.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        alert("Please sign in first.");
        return;
      }

      const body: Record<string, unknown> = {
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        establishment_id: place.establishment_id,
        place_id: place.place_id,
        open_access: openAccess ? true : undefined,
      };
      if (!openAccess) body.code = code.trim();

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Submit failed");
      }

      onSaved?.(openAccess ? null : code.trim(), { openAccess });
      onClose();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !place) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
      >
        <div className="mb-3">
          <div className="text-sm opacity-70">Update code for</div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-xs opacity-70">{place.address ?? "No address"}</div>
        </div>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openAccess}
            onChange={(e) => setOpenAccess(e.target.checked)}
          />
          Customer open access (no code required)
        </label>

        {!openAccess && (
          <div className="mt-3">
            <label className="block text-xs opacity-70 mb-1">Bathroom code</label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 1234#"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium text-emerald-50 disabled:opacity-50"
            disabled={disabled}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="mt-3 text-xs opacity-60">
          Submissions by non-executives are marked as “echelon suggestions.” Executives’ entries are marked “executive”.
        </div>
      </div>
    </div>
  );
}
