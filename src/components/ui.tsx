"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        className={`card my-auto w-full ${wide ? "max-w-3xl" : "max-w-xl"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-bold text-navy">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const TONES = {
  blue: "bg-steel-100 text-steel",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  slate: "bg-slate-100 text-slate-600",
  navy: "bg-navy text-white",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "warning";
  children: ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-2.5 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function MonthFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        className="input !w-auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filtrar por mes"
      />
      {value && (
        <button className="btn-secondary !px-2.5" onClick={() => onChange("")}>
          Todos
        </button>
      )}
    </div>
  );
}

