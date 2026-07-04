"use client";
import { Fragment, ReactNode } from "react";
import type { Citation } from "@/lib/types";
import { STR, type Lang } from "@/lib/i18n";

// Lightweight markdown renderer: headings, lists, links, code, bold, and citation chips.
function renderInline(text: string, citIds: Set<string>, onChip: (id: string) => void, sourceLabel: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([a-z0-9][a-z0-9-]+|doc:[^\]]+\.md)\]|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|`([^`]+)`/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) {
      const id = m[1];
      out.push(
        <button key={k++} className="rule-chip" title={citIds.has(id) ? `${sourceLabel} ${id}` : id}
          onClick={() => onChip(id)}>{id.startsWith("doc:") ? "doc" : "§"} {id}</button>
      );
    } else if (m[2] && m[3]) {
      out.push(
        <a key={k++} href={m[3]} target="_blank" rel="noreferrer" className="font-medium text-teal-700 underline decoration-dotted">
          {m[2]}
        </a>
      );
    } else if (m[4]) {
      out.push(<strong key={k++} className="font-semibold text-slate-800">{m[4]}</strong>);
    } else if (m[5]) {
      out.push(<code key={k++} className="rounded bg-slate-200 px-1 py-0.5 text-[0.92em] text-slate-800">{m[5]}</code>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}

export function AnswerView({ answer, citations, onChip, lang = "de" }: { answer: string; citations: Citation[]; onChip: (id: string) => void; lang?: Lang }) {
  const ids = new Set(citations.map((c) => c.rule_id));
  const sourceLabel = STR[lang].source.sourcePrefix;
  const sections = answer.split("```");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
      {sections.map((section, sectionIndex) =>
        sectionIndex % 2 === 1 ? (
          <pre key={`code-${sectionIndex}`} className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
            <code>{section.replace(/^\w+\n/, "")}</code>
          </pre>
        ) : (
          <Fragment key={`md-${sectionIndex}`}>{renderMarkdownLines(section, ids, onChip, sourceLabel, sectionIndex)}</Fragment>
        ),
      )}
    </div>
  );
}

function renderMarkdownLines(text: string, ids: Set<string>, onChip: (id: string) => void, sourceLabel: string, sectionIndex: number) {
  return text.split("\n").map((line, i) => {
    const t = line.trim();
    const key = `${sectionIndex}-${i}`;

    if (!t) return <div key={key} className="h-1" />;
    if (t.startsWith("### ")) return <h4 key={key} className="pt-1 text-sm font-semibold text-slate-800">{renderInline(t.slice(4), ids, onChip, sourceLabel)}</h4>;
    if (t.startsWith("## ")) return <h3 key={key} className="pt-1 text-base font-semibold text-slate-900">{renderInline(t.slice(3), ids, onChip, sourceLabel)}</h3>;
    if (t.startsWith("# ")) return <h2 key={key} className="pt-1 text-lg font-bold text-slate-900">{renderInline(t.slice(2), ids, onChip, sourceLabel)}</h2>;

    const bullet = /^[-*]\s+(.+)$/.exec(t);
    const numbered = /^\d+\.\s+(.+)$/.exec(t);
    if (bullet || numbered) {
      return (
        <div key={key} className="flex gap-2">
          <span className="mt-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-100 text-[9px] font-semibold text-teal-700">
            {numbered ? t.split(".", 1)[0] : ""}
          </span>
          <p>{renderInline((bullet?.[1] || numbered?.[1] || ""), ids, onChip, sourceLabel)}</p>
        </div>
      );
    }

    if (/^---+$/.test(t)) return <hr key={key} className="my-2 border-slate-200" />;
    return <p key={key}>{renderInline(t, ids, onChip, sourceLabel)}</p>;
  });
}
