"use client";
import type { KBRule } from "@/lib/types";
import { StatusBadge } from "./ui";
import { STR, localizeRule, type Lang } from "@/lib/i18n";

export function SourcePanel({ rules, highlight, lang = "de" }: { rules: KBRule[]; highlight?: string | null; lang?: Lang }) {
  return (
    <div className="space-y-2">
      {rules.map((r) => {
        const loc = localizeRule(r, lang);
        return (
        <div
          key={r.id}
          id={`src-${r.id}`}
          className={`rounded-lg border p-3 transition ${
            highlight === r.id ? "border-teal-400 bg-teal-50 ring-2 ring-teal-200" : "border-slate-200 bg-white"
          }`}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">{loc.title}</span>
            <StatusBadge status={r.status} lang={lang} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {r.source.url ? (
              <a href={r.source.url} target="_blank" rel="noreferrer" className="font-medium text-teal-700 underline decoration-dotted">
                {r.source.name}
              </a>
            ) : (
              <span className="font-medium">{r.source.name}</span>
            )}
            {r.source.as_of && <span>· {STR[lang].source.asOf} {r.source.as_of}</span>}
            {r.source.legal_status && <span>· {r.source.legal_status}</span>}
            <span className="text-slate-300">· {r.id}</span>
          </div>
          {loc.uncertainties.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">⚠ {loc.uncertainties.join(" ")}</p>
          )}
        </div>
        );
      })}
    </div>
  );
}
