"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type {
  AnswerResponse, AssessmentResponse, BuildingInsights, ClarifyingQuestion, ConfigureResponse,
  ProjectContext, PVConfigVariant, SolarLatLng, Topic,
} from "@/lib/types";
import { Card, ScoreGauge, StatusBadge, Tooltip } from "@/components/ui";
import { AnswerView } from "@/components/AnswerView";
import { SourcePanel } from "@/components/SourcePanel";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ChatBot } from "@/components/ChatBot";
import { fetchSolar, contextFromInsights } from "@/lib/solar";
import { STR, localizeRule, type Lang } from "@/lib/i18n";

const SolarMap = dynamic(() => import("@/components/SolarMap"), { ssr: false });
const HAS_MAPS_KEY = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// This version focuses on PV only; the other measures are shown but disabled.
const MEASURES: { key: Topic; icon: string; enabled: boolean }[] = [
  { key: "pv", icon: "solararray", enabled: true },
  { key: "battery", icon: "battery", enabled: false },
  { key: "wallbox", icon: "wallbox", enabled: false },
  { key: "heatpump", icon: "heatpump", enabled: false },
];

const BRAUNSCHWEIG: ProjectContext = {
  address: "38106 Braunschweig", building_type: "single_family", usage: "residential",
  roof_area_m2: 55, roof_azimuth_deg: 180, roof_tilt_deg: 30, shading: "low",
  annual_consumption_kwh: 4500,
  measures: ["pv"], planned_pv_kwp: 9.5, existing_pv: false,
};

type Result = {
  context: ProjectContext;
  clarifying: ClarifyingQuestion[];
  assessment: AssessmentResponse;
  answer: AnswerResponse;
  config: ConfigureResponse;
  insights: BuildingInsights | null;
  solarLoc: SolarLatLng | null;
  lang: Lang;
};

/** Merge: user-entered fields win; Google-Solar-derived values only fill gaps. */
function augment(base: ProjectContext, extra: Partial<ProjectContext>): ProjectContext {
  const out = { ...base } as Record<string, unknown>;
  Object.entries(extra).forEach(([k, v]) => {
    if (out[k] == null && v != null) out[k] = v;
  });
  return out as unknown as ProjectContext;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("de");
  const [form, setForm] = useState<ProjectContext>({ measures: ["pv"], usage: "residential", existing_pv: false });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [insights, setInsights] = useState<BuildingInsights | null>(null);
  const [solarLoc, setSolarLoc] = useState<SolarLatLng | null>(null);
  const [panelCount, setPanelCount] = useState(0);
  const t = STR[lang];

  function set<K extends keyof ProjectContext>(k: K, v: ProjectContext[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function num(v: string): number | null { return v === "" ? null : Number(v); }
  function toggleMeasure(m: Topic) {
    setForm((f) => ({ ...f, measures: f.measures.includes(m) ? f.measures.filter((x) => x !== m) : [...f.measures, m] }));
  }

  async function analyze() {
    // Require the decisive inputs before running — otherwise prompt the user to fill them in.
    const missing: string[] = [];
    if (!form.address?.trim() && !form.plz?.trim())
      missing.push(lang === "de" ? "Adresse oder PLZ" : "address or postal code");
    if (!form.roof_area_m2 && !form.planned_pv_kwp)
      missing.push(lang === "de" ? "Dachfläche oder geplante PV-Leistung (kWp)" : "roof area or planned PV capacity (kWp)");
    if (missing.length) {
      setError((lang === "de"
        ? "Bitte füllen Sie zuerst diese Angaben aus: "
        : "Please fill in this information first: ") + missing.join(", ") + ".");
      return;
    }
    setLoading(true); setError(null);
    try {
      const ctxRes = await api.buildContext(form, lang);
      let context = ctxRes.context;

      // Google Solar augment (real roof azimuth/tilt/area/kWp); user-entered values win.
      let sInsights: BuildingInsights | null = null;
      let sLoc: SolarLatLng | null = null;
      try {
        const solar = await fetchSolar({ address: context.address ?? form.address ?? undefined });
        if (solar?.insights) {
          sInsights = solar.insights;
          sLoc = solar.location;
          context = augment(context, contextFromInsights(solar.insights));
        }
      } catch { /* solar optional → keep keyless path */ }
      setInsights(sInsights);
      setSolarLoc(sLoc);
      setForm((f) => augment(f, context)); // reflect auto-filled values in the form

      const question = t.analyzeQuestion(context.measures.join(", "));
      // Align configurator variants to Google's real panels so the count matches the map overlay.
      const solarOpts = sInsights
        ? { panelWp: sInsights.solarPotential.panelCapacityWatts, maxModules: sInsights.solarPotential.maxArrayPanelsCount }
        : undefined;
      const [assessment, answer, config] = await Promise.all([
        api.assess(context, lang), api.answer(question, context, lang), api.configure(context, lang, solarOpts),
      ]);
      setResult({ context, clarifying: ctxRes.clarifying_questions, assessment, answer, config, insights: sInsights, solarLoc: sLoc, lang });
    } catch (e) {
      setError(t.backendError(e));
    } finally {
      setLoading(false);
    }
  }

  // Click a roof on the Google map → refetch insights AND re-align the configurator/assessment to
  // that exact building, so the variant counts (and the panels drawn) match the clicked roof.
  async function pickRoof(la: number, ln: number) {
    try {
      const solar = await fetchSolar({ lat: la, lng: ln });
      if (!solar?.insights) return;
      const sIns = solar.insights;
      setInsights(sIns);
      setSolarLoc(solar.location);
      const context = augment(result?.context ?? form, contextFromInsights(sIns));
      setForm((f) => augment(f, context));
      const solarOpts = {
        panelWp: sIns.solarPotential.panelCapacityWatts,
        maxModules: sIns.solarPotential.maxArrayPanelsCount,
      };
      const [assessment, config] = await Promise.all([
        api.assess(context, lang), api.configure(context, lang, solarOpts),
      ]);
      setResult((prev) => (prev ? { ...prev, context, assessment, config, insights: sIns, solarLoc: solar.location } : prev));
    } catch { /* ignore */ }
  }

  function onChip(id: string) {
    setHighlight(id);
    document.getElementById(`src-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function exportOnePager() {
    if (!result) return;
    sessionStorage.setItem("kipv_result", JSON.stringify({ ...result, lang }));
    window.open("/onepager", "_blank");
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header lang={lang} setLang={setLang} />
      <main className="mx-auto grid w-full max-w-[1700px] flex-1 grid-cols-1 gap-5 p-4 lg:grid-cols-[330px_1fr]">
        {/* ---- Intake form ---- */}
        <div className="space-y-4">
          <Card title={t.form.captureProject}>
            <div className="space-y-3 text-sm">
              <Field label={t.form.addressLabel} hint={t.form.addressHint}>
                <input className="inp" placeholder={t.form.addressPlaceholder}
                  value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </Field>

              <div>
                <p className="mb-1 font-medium text-slate-600">{t.form.projectLabel}</p>
                <div className="grid grid-cols-2 gap-2">
                  {MEASURES.map((m) => {
                    const on = form.measures.includes(m.key);
                    const disabled = !m.enabled;
                    return (
                      <button key={m.key} disabled={disabled} onClick={() => !disabled && toggleMeasure(m.key)}
                        title={disabled ? (lang === "de" ? "In dieser Version nur PV" : "PV only in this version") : undefined}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium transition ${
                          disabled ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                          : on ? "border-teal-400 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-500"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/icons/${m.icon}.png`} alt="" className={`h-6 w-6 object-contain ${disabled ? "opacity-30" : ""}`} />
                        {t.measures[m.key as keyof typeof t.measures]}
                        {disabled && <span className="ml-auto rounded bg-slate-200 px-1 text-[9px] text-slate-500">{lang === "de" ? "bald" : "soon"}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label={t.form.buildingType}>
                  <select className="inp" value={form.building_type ?? ""} onChange={(e) => set("building_type", (e.target.value || null) as ProjectContext["building_type"])}>
                    <option value="">—</option>
                    <option value="single_family">{t.form.buildingTypes.single_family}</option>
                    <option value="two_family">{t.form.buildingTypes.two_family}</option>
                    <option value="multi_family">{t.form.buildingTypes.multi_family}</option>
                  </select>
                </Field>
                <Field label={t.form.consumption}>
                  <input className="inp" type="number" value={form.annual_consumption_kwh ?? ""} onChange={(e) => set("annual_consumption_kwh", num(e.target.value))} />
                </Field>
                <Field label={t.form.roofArea} hint={t.form.roofAreaHint}>
                  <input className="inp" type="number" value={form.roof_area_m2 ?? ""} onChange={(e) => set("roof_area_m2", num(e.target.value))} />
                </Field>
                <Field label={t.form.plannedPv}>
                  <input className="inp" type="number" value={form.planned_pv_kwp ?? ""} onChange={(e) => set("planned_pv_kwp", num(e.target.value))} />
                </Field>
                <Field label={t.form.orientation} hint={t.form.orientationHint}>
                  <input className="inp" type="number" value={form.roof_azimuth_deg ?? ""} onChange={(e) => set("roof_azimuth_deg", num(e.target.value))} />
                </Field>
                <Field label={t.form.roofPitch}>
                  <input className="inp" type="number" value={form.roof_tilt_deg ?? ""} onChange={(e) => set("roof_tilt_deg", num(e.target.value))} />
                </Field>
                {form.measures.includes("wallbox") && (
                  <Field label={t.form.wallboxKw} hint={t.form.wallboxKwHint}>
                    <input className="inp" type="number" value={form.planned_wallbox_kw ?? ""} onChange={(e) => set("planned_wallbox_kw", num(e.target.value))} />
                  </Field>
                )}
                <Field label={t.form.shading}>
                  <select className="inp" value={form.shading ?? ""} onChange={(e) => set("shading", (e.target.value || null) as ProjectContext["shading"])}>
                    <option value="">—</option>
                    <option value="none">{t.form.shadingOptions.none}</option>
                    <option value="low">{t.form.shadingOptions.low}</option>
                    <option value="medium">{t.form.shadingOptions.medium}</option>
                    <option value="high">{t.form.shadingOptions.high}</option>
                  </select>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={form.existing_pv ?? false} onChange={(e) => set("existing_pv", e.target.checked)} />
                {t.form.extendExisting}
              </label>
              {form.existing_pv && (
                <Field label={t.form.commissioning} hint={t.form.commissioningHint}>
                  <input className="inp" type="date" value={form.existing_pv_commissioning ?? ""} onChange={(e) => set("existing_pv_commissioning", e.target.value || null)} />
                </Field>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={analyze} disabled={loading}
                  className="flex-1 rounded-lg bg-teal-600 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                  {loading ? t.form.analyzing : t.form.analyze}
                </button>
                <button onClick={() => setForm(BRAUNSCHWEIG)} className="rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50">
                  {t.form.example}
                </button>
              </div>
              {error && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
              )}
            </div>
          </Card>
          <p className="px-1 text-[11px] leading-snug text-slate-400">
            {t.form.disclaimerPre}<strong>{t.form.disclaimerStrong}</strong>{t.form.disclaimerPost}
          </p>
        </div>

        {/* ---- Results ---- */}
        <div className="space-y-4">
          {!result && <EmptyState lang={lang} />}
          {result && (
            <Results result={result} highlight={highlight} onChip={onChip} onExport={exportOnePager}
              insights={insights} solarLoc={solarLoc} panelCount={panelCount}
              onVariant={(v) => setPanelCount(v.module_count)} onPickRoof={pickRoof} />
          )}
        </div>
      </main>
      <ChatBot lang={lang} context={result?.context ?? form} onChip={onChip} />
    </div>
  );
}

function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = STR[lang];
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1700px] items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 rotate-45 items-center justify-center rounded bg-teal-600" />
        <div>
          <h1 className="text-lg font-bold leading-none text-slate-800">{t.header.title}</h1>
          <p className="text-xs text-slate-500">{t.header.subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
            {(["de", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2.5 py-1 transition ${
                  lang === l ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            {t.header.notLegallyBinding}
          </span>
        </div>
      </div>
    </header>
  );
}

function EmptyState({ lang }: { lang: Lang }) {
  const t = STR[lang].empty;
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-12 text-center text-slate-400">
        <div className="text-4xl">☀️</div>
        <p className="max-w-md text-sm">
          {t.pre}<strong>{t.analyzeStrong}</strong>{t.post}
        </p>
        <p className="text-xs">{t.tip}</p>
      </div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center text-xs font-medium text-slate-600">
        {label}{hint && <Tooltip text={hint} />}
      </span>
      {children}
    </label>
  );
}

function Results({ result, highlight, onChip, onExport, insights, solarLoc, panelCount, onVariant, onPickRoof }: {
  result: Result; highlight: string | null; onChip: (id: string) => void; onExport: () => void;
  insights: BuildingInsights | null; solarLoc: SolarLatLng | null; panelCount: number;
  onVariant: (v: PVConfigVariant) => void; onPickRoof: (lat: number, lng: number) => void;
}) {
  const { context, clarifying, assessment, answer, config, lang } = result;
  const t = STR[lang];
  const byStatus = (s: string) => answer.applicable_rules.filter((r) => r.status === s);
  return (
    <>
      {/* metrics */}
      <Card title={t.results.techAssessment} right={
        <button onClick={onExport} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
          {t.results.pdfOnePager}
        </button>}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-1"><ScoreGauge score={assessment.score} suitability={assessment.suitability} lang={lang} /></div>
          <Metric label={t.results.metricCapacity} value={assessment.pv_kwp ? `${assessment.pv_kwp} kWp` : "—"} />
          <Metric label={t.results.metricYield} value={assessment.annual_yield_kwh ? `${assessment.annual_yield_kwh.toLocaleString("de-DE")} kWh` : "—"} hint={t.results.metricYieldHint} />
          <Metric label={t.results.metricAutarky} value={assessment.autarky_share != null ? `${Math.round(assessment.autarky_share * 100)} %` : "—"} hint={t.results.metricAutarkyHint} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>📍 {context.address || context.plz || "—"}</span>
          {context.state && <span>· {context.state}</span>}
          {context.grid_operator && <span>· {t.results.gridOperator}: <strong className="text-slate-700">{context.grid_operator}</strong></span>}
        </div>
        {assessment.notes.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">{assessment.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
        )}
      </Card>

      {/* Roof visualization (Google Solar): satellite panel overlay + 3D — the main visual */}
      {HAS_MAPS_KEY && insights && (
        <Card title={lang === "de" ? "Dach-Visualisierung (Satellit / 3D)" : "Roof visualization (satellite / 3D)"}>
          <SolarMap insights={insights} location={solarLoc} panelCount={panelCount} onPickPoint={onPickRoof} lang={lang} />
          <p className="mt-2 text-xs text-slate-500">
            {lang === "de"
              ? "Panelzahl folgt der gewählten Konfiguration (Empfohlen / Dachmaximum)."
              : "Panel count follows the selected configuration (Recommended / Roof maximum)."}
          </p>
        </Card>
      )}

      {/* PV configuration + per-component cost estimate */}
      <Card title={lang === "de" ? "PV-Konfiguration & Kostenschätzung" : "PV configuration & cost estimate"}>
        <ConfigPanel data={config} lang={lang} onSelect={onVariant} />
      </Card>

      {/* clarifying questions */}
      {clarifying.length > 0 && (
        <Card title={t.results.clarifyingTitle}>
          <ul className="space-y-2">
            {clarifying.map((q) => (
              <li key={q.field} className="rounded-lg bg-amber-50 p-2.5 text-sm">
                <p className="font-medium text-amber-900">{q.question}</p>
                <p className="text-xs text-amber-700">{q.why}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* answer */}
      <Card title={t.results.answerTitle} right={answer.cached ? <span className="text-xs text-slate-400">{t.results.fromCache}</span> : null}>
        <AnswerView answer={answer.answer} citations={answer.citations} onChip={onChip} lang={lang} />
        <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] italic text-slate-400">{answer.disclaimer}</p>
      </Card>

      {/* rules checklist */}
      <Card title={t.results.rulesGlance}>
        <div className="space-y-3">
          {(["valid", "announced", "expired"] as const).map((s) => {
            const items = byStatus(s);
            if (!items.length) return null;
            return (
              <div key={s}>
                <div className="mb-1.5"><StatusBadge status={s} lang={lang} /></div>
                <ul className="space-y-1">
                  {items.map((r) => (
                    <li key={r.id} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-teal-500">›</span>
                      <button className="text-left hover:underline" onClick={() => onChip(r.id)}>{localizeRule(r, lang).title}</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={t.results.sources}>
        <SourcePanel rules={answer.applicable_rules} highlight={highlight} lang={lang} />
      </Card>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="flex items-center text-xs text-slate-500">{label}{hint && <Tooltip text={hint} />}</div>
      <div className="mt-1 text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}
