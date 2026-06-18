"""Tiny bilingual (English/German) helper for user-facing backend strings.

`t(lang, en, de)` picks a language inline so English and German live side by side at the call site.
Default language is German (the primary audience), but every endpoint accepts a `lang` parameter.
"""
from __future__ import annotations

from typing import Literal

Lang = Literal["en", "de"]
DEFAULT_LANG: Lang = "de"


def norm(lang: str | None) -> Lang:
    return "de" if (lang or DEFAULT_LANG).lower().startswith("de") else "en"


def t(lang: str, en: str, de: str) -> str:
    return de if norm(lang) == "de" else en


DISCLAIMER = {
    "en": (
        "This information is a source-based orientation and is not legally binding. The relevant "
        "original sources and a review by a specialist company are authoritative."
    ),
    "de": (
        "Diese Auskunft ist eine quellenbasierte Orientierung und nicht rechtsverbindlich. "
        "Maßgeblich sind die jeweils geltenden Originalquellen und die Prüfung durch einen Fachbetrieb."
    ),
}
