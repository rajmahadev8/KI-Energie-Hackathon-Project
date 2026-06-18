"use client";
import { ReactNode, useState } from "react";
import type { Status } from "@/lib/types";
import { STR, type Lang } from "@/lib/i18n";

const STATUS_STYLE: Record<Status, { cls: string; dot: string }> = {
  valid: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  announced: { cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  expired: { cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  unclear: { cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

export function statusMeta(lang: Lang): Record<Status, { label: string; cls: string; dot: string }> {
  return {
    valid: { label: STR[lang].status.valid, ...STATUS_STYLE.valid },
    announced: { label: STR[lang].status.announced, ...STATUS_STYLE.announced },
    expired: { label: STR[lang].status.expired, ...STATUS_STYLE.expired },
    unclear: { label: STR[lang].status.unclear, ...STATUS_STYLE.unclear },
  };
}

export function StatusBadge({ status, lang = "de" }: { status: Status; lang?: Lang }) {
  const m = statusMeta(lang)[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function Card({ title, children, right, className = "" }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Tooltip({ children, text }: { children?: ReactNode; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      {children}
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600"
        aria-label="Explanation"
      >
        ?
      </button>
      {open && (
        <span className="absolute z-20 left-5 top-0 w-56 rounded-lg bg-slate-800 px-3 py-2 text-xs leading-snug text-white shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

export function ScoreGauge({ score, suitability, lang = "de" }: { score: number; suitability: string; lang?: Lang }) {
  const color = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-rose-500";
  const ring = score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-amber-400" : "stroke-rose-400";
  const labels = STR[lang].suitability as Record<string, string>;
  const label = labels[suitability] || suitability;
  const c = 2 * Math.PI * 36;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 88 88" className="h-20 w-20 -rotate-90">
        <circle cx="44" cy="44" r="36" className="fill-none stroke-slate-100" strokeWidth="8" />
        <circle cx="44" cy="44" r="36" className={`fill-none ${ring}`} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{score}<span className="text-sm text-slate-400">/100</span></div>
        <div className="text-xs text-slate-500">{STR[lang].pvSuitability}: {label}</div>
      </div>
    </div>
  );
}
