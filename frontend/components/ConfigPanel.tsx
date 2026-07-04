"use client";
import { useEffect, useState } from "react";
import type { ConfigureResponse, PVConfigVariant } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

function Stat({ k, val }: { k: string; val: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="text-sm font-bold text-slate-800">{val}</div>
    </div>
  );
}

export function ConfigPanel({ data, lang, onSelect }: { data: ConfigureResponse; lang: Lang; onSelect?: (v: PVConfigVariant) => void }) {
  const de = lang === "de";
  const variants = data.variants;
  const [sel, setSel] = useState(
    () => (variants.find((v) => v.id === "recommended") ?? variants[variants.length - 1])?.id,
  );
  const v = variants.find((x) => x.id === sel) ?? variants[0];
  useEffect(() => { if (v) onSelect?.(v); }, [v, onSelect]);
  if (!variants.length)
    return <p className="text-sm text-slate-500">{de ? "Bitte Dachfläche oder geplante Leistung angeben." : "Please provide roof area or planned capacity."}</p>;
  const fmt = (n: number) => n.toLocaleString(de ? "de-DE" : "en-US");

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {de
          ? `Auf das Dach passen bis zu ~${data.max_modules} Module (≈ ${data.max_kwp} kWp).`
          : `Up to ~${data.max_modules} modules fit on the roof (≈ ${data.max_kwp} kWp).`}
      </p>

      {/* variant selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {variants.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              x.id === sel ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
            <div className="font-semibold text-slate-700">{x.name}</div>
            <div className="text-slate-500">{x.module_count} {de ? "Module" : "modules"} · {x.kwp} kWp</div>
          </button>
        ))}
      </div>

      {/* selected stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k={de ? "Module" : "Modules"} val={`${v.module_count}`} />
        <Stat k="kWp" val={`${v.kwp}`} />
        <Stat k={de ? "Ertrag/Jahr" : "Yield/yr"} val={`${fmt(v.annual_yield_kwh)} kWh`} />
        <Stat k={de ? "Autarkie" : "Self-suff."} val={v.self_sufficiency != null ? `${Math.round(v.self_sufficiency * 100)} %` : "—"} />
      </div>
      {v.description && <p className="text-xs text-slate-500">{v.description}</p>}

      {/* per-component bill of materials */}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">{de ? "Komponente" : "Component"}</th>
              <th className="px-2 py-1.5 text-right font-medium">{de ? "Menge" : "Qty"}</th>
              <th className="px-2 py-1.5 text-right font-medium">{de ? "Kosten (Spanne)" : "Cost (range)"}</th>
            </tr>
          </thead>
          <tbody>
            {v.components.map((c) => (
              <tr key={c.key} className="border-t border-slate-100">
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    {c.icon && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`/icons/${c.icon}.png`} alt="" className="h-5 w-5 object-contain" />
                    )}
                    {c.label}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-slate-500">{c.qty} {c.unit}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmt(c.cost_low)}–{fmt(c.cost_high)} €</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <td className="px-2 py-2">{de ? "Gesamt (Richtwert)" : "Total (indicative)"}</td>
              <td className="px-2 py-2 text-right text-xs font-normal text-slate-500">{v.eur_per_kwp_low}–{v.eur_per_kwp_high} €/kWp</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{fmt(v.total_low)}–{fmt(v.total_high)} €</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {v.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-500">{v.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
      )}
      <p className="text-[11px] italic text-slate-400">{data.price_basis} — {data.disclaimer}</p>
    </div>
  );
}
