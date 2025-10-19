// components/AuthModal.tsx
"use client";
import { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
};

export default function AuthModal({ open, onClose, children, title = "Sign in" }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
      >
        <div className="mb-3 text-lg font-semibold">{title}</div>
        {children}
        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
