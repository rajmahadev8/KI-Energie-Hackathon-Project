# Manual Answer Check — verify the assistant's answers yourself (by hand)

This is a do-it-yourself audit. No scripts needed — just the app, a browser, and the primary
sources. The goal: convince yourself (or a judge) that an answer is **correct**, not invented.

## What "correct" means for this tool

It is a **source-based** assistant. An answer is correct when:
1. **Every statement has a source** (a `§ rule-id` chip in the answer + an entry in the *Sources* panel).
2. **The source actually says it** (you open the link and find the statement).
3. **It is current** (the validity badge says *valid*, and the *As of* date is recent) — or, if it's
   *announced* / *outdated*, the answer says so explicitly.
4. **Nothing extra is claimed** — there is no confident statement *without* a source.

If all four hold, the answer is trustworthy. If any fails, that's a finding.

---

## Step 1 — Produce an answer to check

**In the UI** (easiest): open `http://localhost:3000` → click **Example / Beispiel** → **Analyze /
Analysieren**. Use the **DE/EN** toggle if you prefer English. You now see:
- the **answer** with inline `§ rule-id` chips,
- a **Rules at a glance** panel with 🟢 valid / 🟡 announced / 🔴 outdated badges,
- a **Sources** panel: each rule with its **source name, link, legal status, and "As of" date**.

Click any `§` chip in the answer → it jumps to that source. That link is your evidence.

---

## Step 2 — The 3-question test for each sentence

Read the answer one statement at a time. For each, ask:

| Question | How to check | Pass = |
|---|---|---|
| Is it sourced? | Look for a `§ rule-id` chip / matching Sources entry | every claim has one |
| Does the source say it? | Click the source link, find the relevant passage | the passage matches |
| Is it current? | Read the validity badge + "As of" date | *valid* (or clearly marked announced/outdated) |

A statement that fails any of these is a finding — write it down (template at the bottom).

---

## Step 3 — Worked example: audit the Braunschweig answer line-by-line

Run the **Example** case (single-family home, 38106 Braunschweig, PV 9.5 kWp + 22 kW wallbox + heat
pump). Then verify each statement against its **primary source**:

| # | Statement the answer makes | Cited rule | Open this primary source | Confirm exactly this |
|---|---|---|---|---|
| 1 | Roof PV needs **no building permit** in Lower Saxony | `nbauo-pv-verfahrensfrei` | NBauO §32a — https://voris.wolterskluwer-online.de/ (search "NBauO §32a Solar") | Solar on roof/wall surfaces is *verfahrensfrei* |
| 2 | A **22 kW wallbox needs approval** (≤11 kW only registration) | `wallbox-anmeldung-genehmigung-schwelle` | NAV §19 — https://www.gesetze-im-internet.de/nav/__19.html (+ search "VDE-AR-N 4100 Wallbox 11 kW genehmigungspflichtig") | up to 11 kW = notify; above = approval |
| 3 | Wallbox & heat pump **>4.2 kW fall under §14a EnWG** (reduced grid fee) | `enwg-14a-steuerbare-verbrauchseinrichtungen` | §14a EnWG — https://www.gesetze-im-internet.de/enwg_2005/__14a.html | controllable consumers since 2024, reduced grid fee |
| 4 | PV **>7 kWp needs a smart meter** (else 60% feed-in cap) | `msbg-smartmeter-pflicht` | MsbG — https://www.gesetze-im-internet.de/messbg/ + Solarspitzengesetz 2025 | intelligent metering requirement / 60% rule |
| 5 | **Register in the Marktstammdatenregister within 1 month** | `mastr-registrierung-pflicht` | https://www.marktstammdatenregister.de/ | registration deadline = 1 month after commissioning |
| 6 | **Register with BS\|Netz** per VDE-AR-N 4105 | `bsnetz-pv-anmeldung-vde4105` | https://www.bs-netz.de/privatkunden/bau-anschluss/photovoltaikanlagen/ | PV must be registered + connected per VDE-AR-N 4105 |
| 7 | Surplus **feed-in tariff ≤10 kWp = 7.78 ct/kWh** (Feb–Jul 2026) | `eeg-feedin-teileinspeisung-2026h1` | https://www.bundesnetzagentur.de/ (EEG Fördersätze) | the rate for the commissioning window |
| 8 | Aug-2026 tariff cut is **announced, not yet law** | `eeg-feedin-degression-2026h2` | same Bundesnetzagentur page | it's a future/announced degression |
| 9 | The **70% rule no longer applies** (outdated) | `eeg-70-prozent-regel-abgeschafft` | EEG 2023 (abolished §9(2) EEG 2021) | the 70% cap was repealed |

✅ Tick each row. Tip: `docs/sources.md` lists every rule → its source + "As of" date in one table,
so you don't have to hunt.

> Numbers worth double-checking specifically (these are the only "hard" figures):
> **7.78 ct/kWh**, **11 kW** (wallbox threshold), **4.2 kW** (§14a), **7 kWp** (smart meter),
> **1 month** (MaStR), **70%** (old rule). Confirm each against its source above.

---

## Step 4 — Check it's genuinely project-specific (not canned)

Change one input and confirm the answer changes correctly:

| Change | Expected change in the answer |
|---|---|
| Wallbox **22 → 11 kW** | the "needs approval" statement should disappear (only registration) |
| PV **9.5 → 5 kWp** | the smart-meter (>7 kWp) requirement should disappear |
| Address → a city outside Lower Saxony (e.g. **70569 Stuttgart**) | NBauO (Lower Saxony) statements should NOT appear; grid operator changes to Netze BW |
| Tick **"existing PV"** without a date | the assistant should **ask for the commissioning date** before answering |

If the output doesn't react to these, it isn't really using your inputs.

---

## Step 5 — Try to break it (anti-hallucination)

| Try this | A correct tool does this |
|---|---|
| Ask something unrelated: *"What garden insurance do I need for a trampoline?"* | says it's **not covered**, recommends an installer, **cites nothing** — does NOT invent an answer |
| Ask: *"Does the 70% rule still apply?"* | says it's **outdated / no longer in force** |
| Look for any confident claim with **no source chip** | there should be none |

If it confidently answers an out-of-scope question with specifics, that's a red flag.

---

## Step 6 — Red flags (what a *wrong* answer looks like)

- A statement with **no `§` chip** / no Sources entry.
- A source link that **doesn't mention** the claim (or 404s).
- A **number that differs** from the source.
- An **outdated rule presented as current** (no 🔴/“no longer applies” wording).
- The assistant **answering outside its scope** with specifics.
- A claim about your *specific* project that ignores your inputs (Step 4).

---

## Verification template (copy one per answer you audit)

```
Scenario: ______________________   Language: DE / EN   Date checked: __________

#  Statement in the answer            Cited rule            Source says it?  Current?  Notes
1  _________________________________  ___________________   Y / N            Y / N     ______
2  _________________________________  ___________________   Y / N            Y / N     ______
3  _________________________________  ___________________   Y / N            Y / N     ______
...
Out-of-scope question refused?  Y / N
Any claim without a source?     Y / N   ->  which: __________
Project-specific (Step 4 holds)? Y / N

Verdict:  ✅ all statements sourced, current, and matching   /   ⚠ findings above
```

---

## Where to find things fast
- **Sources for every rule:** [`sources.md`](sources.md) (rule → primary source + "As of").
- **In the app:** the *Sources* panel under each answer (clickable links + dates).
- **Reproducible scenarios:** [`test-inputs.json`](test-inputs.json).
- **Want it automated too?** [`evaluation-guide.md`](evaluation-guide.md) §1b runs the same checks for you.

> Reminder: the tool is labelled **not legally binding**. Your manual check confirms the answer
> faithfully reflects current, cited rules — the final legal/technical word still comes from the
> official source and a specialist company.
