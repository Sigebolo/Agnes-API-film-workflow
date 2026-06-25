import React, { useEffect, useState } from "react";
import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export interface ToastItem {
  id: string;
  type: "error" | "success" | "info";
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const dur = toast.duration || 5000;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, dur);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const icons = {
    error: <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
  };

  const borders = {
    error: "border-red-500/30 bg-red-950/90",
    success: "border-emerald-500/30 bg-emerald-950/90",
    info: "border-blue-500/30 bg-blue-950/90",
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl transition-all duration-300 ${borders[toast.type]} ${
        exiting ? "opacity-0 translate-x-4 scale-95" : "opacity-100 translate-x-0 scale-100"
      }`}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <p className="text-xs text-slate-200 leading-relaxed flex-1 break-words">{toast.message}</p>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

let toastCounter = 0;
export function createToast(type: ToastItem["type"], message: string, duration?: number): ToastItem {
  return {
    id: `toast_${++toastCounter}_${Date.now()}`,
    type,
    message,
    duration,
  };
}
