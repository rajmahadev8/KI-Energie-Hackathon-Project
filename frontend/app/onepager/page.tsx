"use client";
import { useEffect, useState } from "react";
import type { AnswerResponse, AssessmentResponse, ClarifyingQuestion, ProjectContext } from "@/lib/types";
import { statusMeta } from "@/components/ui";
import { STR, localizeRule, type Lang } from "@/lib/i18n";

type Result = {
  context: ProjectContext;
  clarifying: ClarifyingQuestion[];
  assessment: AssessmentResponse;
  answer: AnswerResponse;
  lang?: Lang;
};

export default function OnePager() {
  const [r, setR] = useState<Result | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("kipv_result");
    if (raw) setR(JSON.parse(raw));
  }, []);

  const lang: Lang = r?.lang ?? "de";
  const t = STR[lang];

  if (!r) return <div className="p-10 text-slate-500">{t.onePager.noData}</div>;
  const { context: c, assessment: a, answer } = r;
  const today = new Date().toLocaleDateString(lang === "de" ? "de-DE" : "en-GB");

  return (
    <div className="mx-auto my-6 max-w-[820px] bg-white p-10 shadow print-page">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button onClick={() => window.print()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">
          {t.onePager.printButton}
        </button>
      </div>

      <div className="flex items-start justify-between border-b-2 border-teal-600 pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t.onePager.title}</h1>
          <p className="text-sm text-slate-500">{c.address || c.plz || t.onePager.objectFallback} · {c.state || ""} · {t.results.gridOperator}: {c.grid_operator || "—"}</p>
        </div>
        <div className="text-right text-xs text-slate-400">{t.onePager.asOf} {today}<br />{t.onePager.notLegallyBinding}</div>
      </div>

      <Section title={t.onePager.plannedMeasures}>
        <p className="text-sm">{c.measures.map((m) => t.measures[m as keyof typeof t.measures] || m).join(", ") || "—"}
          {c.planned_pv_kwp ? ` · PV ${c.planned_pv_kwp} kWp` : ""}
          {c.planned_wallbox_kw ? ` · ${t.measures.wallbox} ${c.planned_wallbox_kw} kW` : ""}
          {c.planned_heatpump ? ` · ${t.measures.heatpump}` : ""}</p>
      </Section>

      <Section title={t.onePager.techAssessment}>
        <div className="grid grid-cols-4 gap-3 text-sm">
          <KV k={t.onePager.kvPvSuitability} v={`${a.score}/100`} />
          <KV k={t.onePager.kvCapacity} v={a.pv_kwp ? `${a.pv_kwp} kWp` : "—"} />
          <KV k={t.onePager.kvYield} v={a.annual_yield_kwh ? `${a.annual_yield_kwh.toLocaleString("de-DE")} kWh` : "—"} />
          <KV k={t.onePager.kvAutarky} v={a.autarky_share != null ? `${Math.round(a.autarky_share * 100)} %` : "—"} />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">{t.onePager.yieldNote}</p>
      </Section>

      <Section title={t.onePager.regulatory}>
        <div className="space-y-1.5">
          {answer.applicable_rules.map((rule) => (
            <div key={rule.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: bg(rule.status), color: fg(rule.status) }}>
                {statusMeta(lang)[rule.status].label}
              </span>
              <div>
                <span className="font-medium text-slate-700">{localizeRule(rule, lang).title}.</span>{" "}
                <span className="text-slate-500">{rule.source.name}{rule.source.as_of ? ` (${t.onePager.ruleAsOf} ${rule.source.as_of})` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <p className="mt-6 border-t border-slate-200 pt-2 text-[10px] text-slate-400">
        {t.onePager.footer}
      </p>
    </div>
  );
}

function bg(s: string) { return ({ valid: "#d1fae5", announced: "#fef3c7", expired: "#ffe4e6", unclear: "#f1f5f9" } as Record<string, string>)[s]; }
function fg(s: string) { return ({ valid: "#047857", announced: "#b45309", expired: "#be123c", unclear: "#475569" } as Record<string, string>)[s]; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-teal-700">{title}</h2>
      {children}
    </section>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div className="rounded bg-slate-50 p-2"><div className="text-[11px] text-slate-500">{k}</div><div className="font-bold text-slate-800">{v}</div></div>;
}
