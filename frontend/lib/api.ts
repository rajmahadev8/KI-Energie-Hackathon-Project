import type {
  AnswerResponse,
  AssessmentResponse,
  ConfigureResponse,
  ContextResponse,
  KBRule,
  ProjectContext,
  RoofVisionResponse,
} from "./types";
import type { Lang } from "./i18n";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  buildContext: (ctx: ProjectContext, lang: Lang = "de") =>
    post<ContextResponse>(`/context?lang=${lang}`, ctx),
  assess: (ctx: ProjectContext, lang: Lang = "de") =>
    post<AssessmentResponse>(`/assess?lang=${lang}`, ctx),
  configure: (ctx: ProjectContext, lang: Lang = "de", opts?: { panelWp?: number; maxModules?: number }) => {
    const p = new URLSearchParams({ lang });
    if (opts?.panelWp) p.set("panel_wp", String(Math.round(opts.panelWp)));
    if (opts?.maxModules) p.set("max_modules", String(Math.round(opts.maxModules)));
    return post<ConfigureResponse>(`/configure?${p.toString()}`, ctx);
  },
  answer: (question: string, context: ProjectContext, lang: Lang = "de", history?: { role: string; text: string }[]) =>
    post<AnswerResponse>("/answer", { question, context, lang, history: history ?? [] }),
  rules: async (): Promise<KBRule[]> => {
    const res = await fetch(`${BASE}/rules`);
    if (!res.ok) throw new Error(`/rules -> ${res.status}`);
    return res.json();
  },
  visionRoof: async (file?: File): Promise<RoofVisionResponse> => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    const res = await fetch(`${BASE}/vision/roof`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`/vision/roof -> ${res.status}`);
    return res.json();
  },
};
