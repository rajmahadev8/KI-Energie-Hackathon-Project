"use client";
import { Fragment, ReactNode } from "react";
import type { Citation } from "@/lib/types";
import { STR, type Lang } from "@/lib/i18n";

// Lightweight renderer: turns [rule-id] into clickable source chips and **text** into bold.
function renderInline(text: string, citIds: Set<string>, onChip: (id: string) => void, sourceLabel: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([a-z0-9][a-z0-9-]+)\]|\*\*(.+?)\*\*/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) {
      const id = m[1];
      out.push(
        <button key={k++} className="rule-chip" title={citIds.has(id) ? `${sourceLabel} ${id}` : id}
          onClick={() => onChip(id)}>§ {id}</button>
      );
    } else if (m[2]) {
      out.push(<strong key={k++} className="font-semibold text-slate-800">{m[2]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}

export function AnswerView({ answer, citations, onChip, lang = "de" }: { answer: string; citations: Citation[]; onChip: (id: string) => void; lang?: Lang }) {
  const ids = new Set(citations.map((c) => c.rule_id));
  const sourceLabel = STR[lang].source.sourcePrefix;
  const lines = answer.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        if (t.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-teal-400" />
              <p>{renderInline(t.slice(2), ids, onChip, sourceLabel)}</p>
            </div>
          );
        }
        return <p key={i}>{renderInline(t, ids, onChip, sourceLabel)}</p>;
      })}
    </div>
  );
}
