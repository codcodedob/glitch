// components/DebugModal.tsx
"use client";

import { createPortal } from "react-dom";

export default function DebugModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  // Render directly to <body> so Leaflet can't cover it
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60"
      aria-modal
      role="dialog"
    >
      <div className="rounded-xl bg-slate-900 p-6 text-white shadow-2xl max-w-sm w-full text-center">
        <h2 className="text-lg font-semibold mb-3">🧪 Modal Test</h2>
        <p className="text-sm mb-4">If you can see this, modals are rendering above the map.</p>
        <button
          onClick={onClose}
          className="rounded border border-slate-600 px-4 py-2 hover:bg-slate-700"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
