"use client";
import type { Topic } from "@/lib/types";
import { STR, type Lang } from "@/lib/i18n";

type IconKey = keyof typeof STR["en"]["houseDiagram"];
type Comp = { icon: IconKey; activeFor: Topic[] | "core" };

// Object-centered components (icons provided by Plankton PV).
const COMPONENTS: Comp[] = [
  { icon: "solararray", activeFor: ["pv"] },
  { icon: "inverter", activeFor: ["pv"] },
  { icon: "battery", activeFor: ["battery"] },
  { icon: "meterbox", activeFor: "core" },
  { icon: "surgeprotector", activeFor: ["pv"] },
  { icon: "grounding", activeFor: ["pv"] },
  { icon: "wallbox", activeFor: ["wallbox"] },
  { icon: "heatpump", activeFor: ["heatpump"] },
  { icon: "router", activeFor: "core" },
];

export function HouseDiagram({ measures, lang = "de" }: { measures: Topic[]; lang?: Lang }) {
  const isActive = (c: Comp) =>
    c.activeFor === "core" ? measures.includes("pv") : c.activeFor.some((m) => measures.includes(m));
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
      {COMPONENTS.map((c) => {
        const active = isActive(c);
        const label = STR[lang].houseDiagram[c.icon];
        return (
          <div
            key={c.icon}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition ${
              active ? "border-teal-300 bg-teal-50/60" : "border-slate-100 bg-slate-50 opacity-45"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/icons/${c.icon}.png`} alt={label} className="h-12 w-12 object-contain" />
            <span className="text-[11px] font-medium leading-tight text-slate-600">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
