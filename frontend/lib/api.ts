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
  configure: (ctx: ProjectContext, lang: Lang = "de") =>
    post<ConfigureResponse>(`/configure?lang=${lang}`, ctx),
  answer: (question: string, context: ProjectContext, lang: Lang = "de") =>
    post<AnswerResponse>("/answer", { question, context, lang }),
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
