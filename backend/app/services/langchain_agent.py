"""LangChain ReAct agent for grounded PV answers.

The agent has three tools:
- structured project rules from the existing YAML knowledge base
- local repository docs under docs/*.md
- Tavily web search, only when TAVILY_API_KEY is configured

If LangChain/OpenRouter/Tavily is unavailable, callers should fall back to the deterministic
template answer in answer.py.
"""
from __future__ import annotations

from pathlib import Path
import re

from app.config import settings
from app.i18n import norm
from app.models import KBRule, ProjectContext


class AgentUnavailable(RuntimeError):
    pass


DOCS_DIR = Path(__file__).resolve().parents[3] / "docs"


def _context_summary(ctx: ProjectContext, lang: str) -> str:
    de = norm(lang) == "de"
    parts = []
    if ctx.address or ctx.plz:
        parts.append(f"{'Standort' if de else 'Location'}: {ctx.address or ''} {ctx.plz or ''}".strip())
    if ctx.state:
        parts.append(f"{'Bundesland' if de else 'State'}: {ctx.state}")
    if ctx.grid_operator:
        parts.append(f"{'Netzbetreiber' if de else 'Grid operator'}: {ctx.grid_operator}")
    if ctx.roof_area_m2:
        parts.append(f"{'Dachfläche' if de else 'Roof area'}: {ctx.roof_area_m2} m²")
    if ctx.planned_pv_kwp:
        parts.append(f"{'geplante PV' if de else 'planned PV'}: {ctx.planned_pv_kwp} kWp")
    if ctx.annual_consumption_kwh:
        parts.append(f"{'Verbrauch' if de else 'Consumption'}: {ctx.annual_consumption_kwh} kWh/a")
    return "; ".join(parts) or ("keine Angaben" if de else "no details provided")


def _history_summary(history: list[dict[str, str]]) -> str:
    if not history:
        return "No previous chat messages."

    clean: list[str] = []
    for turn in history[-8:]:
        role = turn.get("role", "user")
        text = (turn.get("text") or "").strip().replace("\n", " ")
        if text:
            clean.append(f"{role}: {text[:700]}")
    return "\n".join(clean) or "No previous chat messages."


def _serialize_rules(rules: list[KBRule], lang: str) -> str:
    if not rules:
        return "No matching structured rules."

    lines = []
    for rule in rules:
        loc = rule.localized(lang)
        lines.append(
            f"[{rule.id}] status={rule.status}\n"
            f"Title: {loc['title']}\n"
            f"Statement: {loc['statement']}\n"
            f"Source: {rule.source.name}; URL: {rule.source.url or 'n/a'}; as_of={rule.source.as_of}"
        )
    return "\n\n".join(lines)


def _doc_snippets(query: str, limit: int = 6) -> str:
    if not DOCS_DIR.exists():
        return "No local docs directory found."

    words = [w for w in re.split(r"\W+", query.lower()) if len(w) > 3]
    matches: list[tuple[int, str, str]] = []
    for path in sorted(DOCS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        lower = text.lower()
        score = sum(lower.count(word) for word in words)
        if score <= 0 and words:
            continue
        snippet = text[:1800] if score <= 0 else _best_snippet(text, words)
        matches.append((score, path.name, snippet.strip()))

    if not matches:
        return "No matching local docs found."

    matches.sort(key=lambda item: item[0], reverse=True)
    return "\n\n".join(
        f"[doc:{name}]\n{snippet}" for _, name, snippet in matches[:limit]
    )


def _best_snippet(text: str, words: list[str]) -> str:
    lower = text.lower()
    positions = [lower.find(word) for word in words if lower.find(word) >= 0]
    if not positions:
        return text[:1800]
    start = max(0, min(positions) - 450)
    end = min(len(text), start + 1800)
    return text[start:end]


def run_agent(
    question: str,
    ctx: ProjectContext,
    surfaced_rules: list[KBRule],
    lang: str = "de",
    history: list[dict[str, str]] | None = None,
) -> str:
    if not settings.llm_enabled:
        raise AgentUnavailable("OPENROUTER_API_KEY not set")

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_core.tools import StructuredTool
        from langchain_openai import ChatOpenAI
        from langgraph.prebuilt import create_react_agent
    except Exception as exc:  # noqa: BLE001
        raise AgentUnavailable(f"LangChain dependencies unavailable: {exc}") from exc

    tool_list = [
        StructuredTool.from_function(
            func=lambda query: _serialize_rules(surfaced_rules, lang),
            name="local_structured_rules",
            description=(
                "Use first. Returns structured source rules already matched to the project context. "
                "Cite rule IDs exactly like [rule-id]."
            ),
        ),
        StructuredTool.from_function(
            func=lambda query: _doc_snippets(query or question),
            name="local_project_docs",
            description=(
                "Search local project documentation under docs/*.md. Use for architecture, sources, "
                "demo constraints, and challenge context. Cite docs like [doc:sources.md]."
            ),
        ),
    ]

    if settings.tavily_api_key:
        try:
            from langchain_community.tools.tavily_search import TavilySearchResults

            tool_list.append(
                TavilySearchResults(
                    max_results=4,
                    description=(
                        "Use only when local structured rules and local docs are insufficient. "
                        "Prefer official sources. Include URLs in the answer when using web results."
                    ),
                )
            )
        except Exception:
            pass

    llm = ChatOpenAI(
        model=settings.text_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0.15,
    )
    language = "German" if norm(lang) == "de" else "English"
    system_prompt = (
        "You are the AI PV Assistant inside a solar planning dashboard for a specific house in Germany. "
        "Your job is to give practical, source-grounded, personalized guidance for rooftop photovoltaic planning.\n\n"
        "DOMAIN SCOPE:\n"
        "- Answer only questions about rooftop PV, Solar API roof potential, module count, kWp sizing, expected yield, "
        "grid connection, metering, feed-in tariffs, registration, Niedersachsen/Braunschweig rules, funding, and next planning steps.\n"
        "- If the user asks about unrelated topics, say that you can only help with PV planning for this project.\n"
        "- Do not provide final legal, tax, structural, or electrical design approval. Recommend installer/grid-operator review where needed.\n\n"
        "PERSONALIZATION:\n"
        "- Always use the project context below as the basis for the answer. Mention relevant house-specific facts when useful: "
        "address/location, state, grid operator, roof area, roof pitch/azimuth, planned PV size, consumption, existing PV, and selected measures.\n"
        "- Use recent chat history to understand follow-up questions, references like 'that', and prior recommendations you gave. "
        "Do not contradict earlier advice unless sources or context changed; if you correct earlier advice, explain why.\n"
        "- If the context is incomplete, answer what can be answered and ask only the missing questions that materially affect the decision.\n"
        "- Prefer concrete next steps for the homeowner over generic explanations.\n\n"
        "SOURCE AND TOOL POLICY:\n"
        "- You MUST answer from sources, not from memory.\n"
        "- Use local_structured_rules first. These are the authoritative project rules and must be cited as [rule-id].\n"
        "- Use local_project_docs second for project documentation, architecture, source logs, demo constraints, and challenge-specific context. Cite as [doc:filename.md].\n"
        "- Use Tavily web search only when local rules/docs are insufficient or the user explicitly asks for current external information. "
        "Prefer official sources such as laws, Bundesnetzagentur, KfW, grid operators, municipalities, and standards bodies. Include URLs for Tavily-backed claims.\n"
        "- Every regulatory, funding, tariff, technical-threshold, or grid-connection claim needs a citation.\n\n"
        "ANSWER STYLE:\n"
        "- Be concise, clear, and useful for a non-expert homeowner.\n"
        "- Structure answers with short sections when helpful: assessment for this house, applicable rules, risks/unknowns, next steps, sources.\n"
        "- Clearly distinguish currently valid, announced/planned, expired/outdated, and uncertain rules.\n"
        "- Never invent numbers, tariff rates, deadlines, or source names. If sources are insufficient, say what is missing instead of guessing.\n"
        "- If the user asks for a recommendation, give a cautious recommendation tied to the house context and cite the basis.\n"
        f"- Answer in {language}.\n\n"
        f"PROJECT CONTEXT FOR THIS HOUSE:\n{_context_summary(ctx, lang)}\n\n"
        f"RECENT CHAT HISTORY:\n{_history_summary(history or [])}"
    )
    agent = create_react_agent(model=llm, tools=tool_list)

    try:
        result = agent.invoke(
            {
                "messages": [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=question),
                ],
            }
        )
    except Exception as exc:  # noqa: BLE001
        raise AgentUnavailable(str(exc)) from exc

    messages = result.get("messages") or []
    answer = str(messages[-1].content if messages else "").strip()
    if not answer:
        raise AgentUnavailable("Agent returned an empty answer")
    return answer


def cited_doc_names(answer: str) -> set[str]:
    return set(re.findall(r"\[doc:([^\]]+)\]", answer))
