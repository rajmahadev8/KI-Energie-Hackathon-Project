# Quellen-Nachweis (Provenance Log)

All rules stored in the knowledge base (`backend/app/knowledge/rules/*.yaml`) have been checked against
the sources listed below. **As of research: 2026-06-17.** Secondary sources were used to determine
values; the respective primary sources are authoritative. The assistant is
**not legally binding**.

| Regel-ID | Aussage (kurz) | Status | Quelle / Rechtsstand | Stand |
|---|---|---|---|---|
| `eeg-feedin-teileinspeisung-2026h1` | Feed-in tariff for surplus (7.78 ct ≤10 kWp) | valid | Bundesnetzagentur / EEG 2023 §§48,49 | 2026-02-01 |
| `eeg-feedin-volleinspeisung-2026h1` | Feed-in tariff for full feed-in (12.34 ct ≤10 kWp) | valid | Bundesnetzagentur / EEG 2023 §§48,49 | 2026-02-01 |
| `eeg-feedin-degression-2026h2` | Reduction from 08/2026 | announced | Bundesnetzagentur (degression) | 2026-06-01 |
| `solarspitzen-negative-preise-2025` | No compensation during negative prices | valid | Solarspitzengesetz / EnWG amendment 2025 | 2025-02-25 |
| `solarspitzen-60-prozent-cap-2025` | 60% feed-in limit without smart meter | valid | Solarspitzengesetz 2025 | 2025-02-25 |
| `eeg-70-prozent-regel-abgeschafft` | 70% rule repealed | outdated | EEG 2023 (removal of §9 para. 2 EEG 2021) | 2023-01-01 |
| `mastr-registrierung-pflicht` | MaStR registration within 1 month | valid | MaStRV / Bundesnetzagentur | 2026-01-01 |
| `eeg-reform-2027-feedin-angekuendigt` | Reform of funding for small PV | announced | Reporting / draft bill | 2026-05-01 |
| `direktvermarktung-ab-25kw-angekuendigt` | Direct marketing phased in from 25 kW | announced | Solarspitzengesetz / EnWG amendment | 2025-02-25 |
| `bsnetz-pv-anmeldung-vde4105` | PV registration + VDE-AR-N 4105 (Braunschweig) | valid | BS\|NETZ TAB NS Nord 2023 | 2024-03-01 |
| `enwg-14a-steuerbare-verbrauchseinrichtungen` | §14a EnWG (>4.2 kW, reduced grid fee) | valid | §14a EnWG / BNetzA BK6-22-300/301 | 2024-01-01 |
| `wallbox-anmeldung-genehmigung-schwelle` | ≤11 kW registration / >11 kW approval | valid | NAV §19 / VDE-AR-N 4100 | 2026-01-01 |
| `nbauo-pv-verfahrensfrei` | Roof PV exempt from approval (NI) | valid | NBauO §32a / Anhang §60 | 2025-01-01 |
| `nbauo-pv-pflicht-neubau` | PV obligation for new builds (NI, since 2025) | valid | NBauO §32a | 2025-01-01 |
| `msbg-smartmeter-pflicht` | Smart meter from 7 kWp | valid | MsbG / Solarspitzengesetz | 2025-02-25 |
| `kfw-270-foerderkredit` | KfW 270 funding loan | active | KfW Programm 270 | 2026-05-01 |
| `battery-sizing-faustregel` | Storage ~1 kWh/kWp | orientation | Industry standard / Verbraucherzentrale | 2026-01-01 |
| `wallbox-pv-ueberschussladen` | Wallbox + PV surplus charging | orientation | derived (§14a, BS\|NETZ) | 2026-01-01 |
| `heatpump-pv-kombination` | Heat pump + PV, limited solar coverage | orientation | derived (§14a) | 2026-01-01 |
| `beg-heizungsfoerderung-waermepumpe` | BEG heating subsidy up to 70% | active | BEG / KfW Zuschuss 458 | 2026-05-01 |

## Primary source links
- Gesetze im Internet — EEG, EnWG (§14a), NAV, MsbG: https://www.gesetze-im-internet.de/
- Bundesnetzagentur (EEG tariff rates/degression): https://www.bundesnetzagentur.de/
- Marktstammdatenregister: https://www.marktstammdatenregister.de/
- NBauO §32a (NI-VORIS): https://voris.wolterskluwer-online.de/
- BS|NETZ Photovoltaik / TAB: https://www.bs-netz.de/privatkunden/bau-anschluss/photovoltaikanlagen/
- KfW 270 / BEG 458: https://www.kfw.de/

> Note: the stored numeric values (e.g. tariff rates) are degressive and depend on the effective date.
> Before a decision, the value valid as of the planned commissioning date must be verified.
