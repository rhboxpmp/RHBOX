"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

export interface SuccessToastData {
  title: string;
  subtitle?: string;
}

export function useSuccessToast(durationMs = 4000) {
  const [toast, setToast] = useState<SuccessToastData | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToast({ title, subtitle });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, clearToast };
}

export function SuccessToast({
  toast,
  onClose,
}: {
  toast: SuccessToastData | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 bg-white border border-emerald-200 shadow-2xl rounded-2xl px-5 py-4 flex items-center gap-3.5 max-w-sm"
    >
      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Check size={22} strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-bold text-emerald-800 text-sm">{toast.title}</div>
        {toast.subtitle && (
          <div className="text-[#344054] truncate mt-0.5">{toast.subtitle}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar confirmação"
        className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
      >
        <X size={15} />
      </button>
    </div>
  );
}
