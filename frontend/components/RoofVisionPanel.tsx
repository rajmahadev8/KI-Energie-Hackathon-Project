"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { RoofVisionResponse } from "@/lib/types";
import { STR, type Lang } from "@/lib/i18n";

export function RoofVisionPanel({ lang = "de" }: { lang?: Lang }) {
  const t = STR[lang].roofVision;
  const [res, setRes] = useState<RoofVisionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(file?: File) {
    setLoading(true); setErr(null);
    try { setRes(await api.visionRoof(file)); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/roof_drone.jpg" alt={t.imgAlt} className="h-40 w-full rounded-lg object-cover" />
        <div className="flex flex-col justify-center gap-2">
          <p className="text-xs text-slate-500">
            {t.descPre}<strong>{t.descStrong}</strong>{t.descPost}
          </p>
          <div className="flex gap-2">
            <button onClick={() => run()} disabled={loading}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {loading ? t.analyzing : t.analyzeExample}
            </button>
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              {t.ownImage}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {res && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          {res.estimated_modules != null && (
            <p className="font-medium text-slate-700">
              {t.estimatePre}{res.estimated_modules} {t.modulesWord}
              {res.estimated_kwp ? ` (≈ ${res.estimated_kwp} kWp)` : ""}
            </p>
          )}
          {res.usable_area_note && <p className="mt-1 text-slate-600">{res.usable_area_note}</p>}
          {res.uncertainties.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-700">
              {res.uncertainties.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
