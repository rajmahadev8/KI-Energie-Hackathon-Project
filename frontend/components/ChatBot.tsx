"use client";
import { useEffect, useRef, useState } from "react";
import type { Citation, ProjectContext } from "@/lib/types";
import { api } from "@/lib/api";
import { AnswerView } from "./AnswerView";
import type { Lang } from "@/lib/i18n";

interface Message {
  role: "user" | "bot";
  text: string;
  citations?: Citation[];
  out_of_scope?: boolean;
  error?: boolean;
}

const DEFAULT_CTX: ProjectContext = { measures: ["pv"] };

const SUGGESTIONS: Record<Lang, string[]> = {
  de: [
    "Was ist die Einspeisevergütung 2026?",
    "Brauche ich eine Baugenehmigung für PV?",
    "Wie viel kWp passen auf 40 m² Dachfläche?",
    "Was ist der Unterschied zwischen Voll- und Teileinspeisung?",
  ],
  en: [
    "What is the feed-in tariff in 2026?",
    "Do I need a building permit for PV?",
    "How many kWp fit on a 40 m² roof?",
    "What is the difference between full and partial feed-in?",
  ],
};

export function ChatBot({
  lang = "de",
  context,
  onChip,
}: {
  lang?: Lang;
  context?: ProjectContext;
  onChip?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleChip(id: string) {
    if (onChip) {
      // Close/minimize chat so the main sources panel is visible, then scroll.
      setOpen(false);
      // Small delay so the panel re-renders before scrolling.
      setTimeout(() => {
        onChip(id);
        document.getElementById(`src-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
  }

  function handleSourceClick(citation: Citation) {
    // If this rule exists in the main sources panel, scroll there.
    const el = document.getElementById(`src-${citation.rule_id}`);
    if (el && onChip) {
      setOpen(false);
      setTimeout(() => {
        onChip(citation.rule_id);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    } else if (citation.url) {
      window.open(citation.url, "_blank", "noreferrer");
    }
  }

  async function send(question?: string) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const ctx = context ?? DEFAULT_CTX;
      const res = await api.answer(q, ctx, lang);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: res.answer,
          citations: res.citations,
          out_of_scope: res.out_of_scope,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text:
            lang === "de"
              ? "Fehler – Backend nicht erreichbar."
              : "Error – backend not reachable.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const label = lang === "de" ? "PV-Chat" : "PV Chat";
  const placeholder = lang === "de" ? "Frage stellen …" : "Ask a question …";
  const sourcesLabel = lang === "de" ? "Quellen" : "Sources";
  const scrollHint = lang === "de" ? "→ Quelle anzeigen" : "→ Show source";
  const outOfScopeMsg =
    lang === "de"
      ? "Diese Frage liegt außerhalb meines Themenbereichs (PV-Anlagen, Speicher, Wallbox, Wärmepumpe in Deutschland). Bitte stellen Sie eine Frage zu einem dieser Themen."
      : "This question is outside my topic area (PV systems, battery storage, wallbox, heat pump in Germany). Please ask about one of these topics.";
  const resetLabel = lang === "de" ? "Verlauf löschen" : "Clear history";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* header */}
          <div className="flex items-center justify-between bg-teal-600 px-4 py-2.5">
            <div className="flex items-center gap-2">
              {/* chat icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm font-semibold text-white">{label}</span>
              <span className="rounded-full bg-teal-500 px-1.5 py-0.5 text-[9px] font-bold text-teal-100">AI</span>
            </div>
            <div className="flex items-center gap-1">
              {/* reset button */}
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  title={resetLabel}
                  className="rounded-full p-1 text-teal-100 transition hover:bg-teal-700 hover:text-white"
                  aria-label={resetLabel}
                >
                  {/* rotate-left / refresh icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
              {/* minimize button */}
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-teal-100 transition hover:bg-teal-700 hover:text-white"
                aria-label="Minimize chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="11" width="16" height="2" rx="1" />
                </svg>
              </button>
            </div>
          </div>

          {/* messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="space-y-3 pt-1">
                <p className="text-center text-xs text-slate-500">
                  {lang === "de"
                    ? "Fragen Sie mich zu PV-Regeln, Vergütung und Technik in Deutschland."
                    : "Ask me about PV rules, tariffs and technology in Germany."}
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS[lang].map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-left text-xs text-teal-800 transition hover:bg-teal-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-sm bg-teal-600 text-white"
                      : m.error
                      ? "rounded-bl-sm border border-rose-200 bg-rose-50 text-rose-800"
                      : m.out_of_scope
                      ? "rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-800"
                      : "rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {m.role === "user" || m.error ? (
                    <span>{m.text}</span>
                  ) : m.out_of_scope ? (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-base">🚫</span>
                      <span className="text-xs leading-relaxed">{outOfScopeMsg}</span>
                    </div>
                  ) : (
                    <>
                      <AnswerView
                        answer={m.text}
                        citations={m.citations ?? []}
                        onChip={handleChip}
                        lang={lang}
                      />
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {sourcesLabel}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {m.citations.map((c) => (
                              <SourceLine
                                key={c.rule_id}
                                citation={c}
                                scrollHint={scrollHint}
                                hasMainPanel={!!document.getElementById(`src-${c.rule_id}`)}
                                onClick={() => handleSourceClick(c)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: "160ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: "320ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* input bar */}
          <div className="flex gap-2 border-t border-slate-200 p-2.5">
            <input
              ref={inputRef}
              className="inp flex-1 text-xs"
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center rounded-lg bg-teal-600 px-3 py-1.5 text-white transition hover:bg-teal-700 disabled:opacity-40"
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-700"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {open ? (lang === "de" ? "Schließen" : "Close") : label}
      </button>
    </div>
  );
}

function SourceLine({
  citation,
  scrollHint,
  hasMainPanel,
  onClick,
}: {
  citation: Citation;
  scrollHint: string;
  hasMainPanel: boolean;
  onClick: () => void;
}) {
  const dot =
    citation.status === "valid"
      ? "bg-emerald-500"
      : citation.status === "announced"
      ? "bg-amber-500"
      : "bg-rose-400";

  const isClickable = hasMainPanel || !!citation.url;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-[10px] transition ${
        isClickable
          ? "hover:bg-teal-50 cursor-pointer"
          : "cursor-default"
      }`}
      title={hasMainPanel ? scrollHint : citation.url ?? undefined}
    >
      <span className={`mt-0.5 h-1.5 w-1.5 flex-none rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <span
          className={`block truncate font-medium ${
            isClickable ? "text-teal-700 underline decoration-dotted" : "text-slate-600"
          }`}
        >
          {citation.source_name}
        </span>
        <span className="text-slate-400">
          {citation.as_of ? `${citation.as_of} · ` : ""}
          {citation.rule_id}
          {hasMainPanel && (
            <span className="ml-1 text-teal-500">{scrollHint}</span>
          )}
        </span>
      </div>
    </button>
  );
}
