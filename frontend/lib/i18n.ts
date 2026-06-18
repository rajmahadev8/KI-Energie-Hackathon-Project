import type { KBRule } from "./types";

export type Lang = "de" | "en";

type BuildingTypeKey = "single_family" | "two_family" | "multi_family";
type ShadingKey = "none" | "low" | "medium" | "high";
type MeasureKey = "pv" | "battery" | "wallbox" | "heatpump";
type StatusKey = "valid" | "announced" | "expired" | "unclear";
type SuitabilityKey = "good" | "moderate" | "limited" | "unknown";
type HouseComponentKey =
  | "solararray" | "inverter" | "battery" | "meterbox"
  | "surgeprotector" | "grounding" | "wallbox" | "heatpump" | "router";

export interface Strings {
  header: { title: string; subtitle: string; notLegallyBinding: string };
  measures: Record<MeasureKey, string>;

  form: {
    captureProject: string;
    addressLabel: string;
    addressHint: string;
    addressPlaceholder: string;
    projectLabel: string;
    buildingType: string;
    buildingTypes: Record<BuildingTypeKey, string>;
    consumption: string;
    roofArea: string;
    roofAreaHint: string;
    plannedPv: string;
    orientation: string;
    orientationHint: string;
    roofPitch: string;
    wallboxKw: string;
    wallboxKwHint: string;
    shading: string;
    shadingOptions: Record<ShadingKey, string>;
    extendExisting: string;
    commissioning: string;
    commissioningHint: string;
    analyze: string;
    analyzing: string;
    example: string;
    disclaimerPre: string;
    disclaimerStrong: string;
    disclaimerPost: string;
  };

  backendError: (e: unknown) => string;
  analyzeQuestion: (measures: string) => string;

  empty: {
    pre: string;
    analyzeStrong: string;
    post: string;
    tip: string;
  };

  results: {
    techAssessment: string;
    pdfOnePager: string;
    metricCapacity: string;
    metricYield: string;
    metricYieldHint: string;
    metricAutarky: string;
    metricAutarkyHint: string;
    gridOperator: string;
    clarifyingTitle: string;
    answerTitle: string;
    fromCache: string;
    rulesGlance: string;
    systemOverview: string;
    location: string;
    sources: string;
    roofVision: string;
    nextSteps: string;
    openPoints: string;
    installerQuestions: string;
  };

  status: Record<StatusKey, string>;
  suitability: Record<SuitabilityKey, string>;
  pvSuitability: string;

  houseDiagram: Record<HouseComponentKey, string>;

  source: { asOf: string; sourcePrefix: string };

  roofVision: {
    imgAlt: string;
    descPre: string;
    descStrong: string;
    descPost: string;
    analyzeExample: string;
    analyzing: string;
    ownImage: string;
    estimatePre: string;
    modulesWord: string;
  };

  onePager: {
    noData: string;
    printButton: string;
    title: string;
    objectFallback: string;
    asOf: string;
    notLegallyBinding: string;
    plannedMeasures: string;
    techAssessment: string;
    kvPvSuitability: string;
    kvCapacity: string;
    kvYield: string;
    kvAutarky: string;
    yieldNote: string;
    regulatory: string;
    ruleAsOf: string;
    openPoints: string;
    nextSteps: string;
    footer: string;
  };
}

export const STR: Record<Lang, Strings> = {
  de: {
    header: {
      title: "KI-PV-Assistent",
      subtitle: "Quellenbasierte Orientierung für PV, Speicher, Wallbox & Wärmepumpe",
      notLegallyBinding: "nicht rechtsverbindlich",
    },
    measures: {
      pv: "PV-Anlage",
      battery: "Speicher",
      wallbox: "Wallbox",
      heatpump: "Wärmepumpe",
    },
    form: {
      captureProject: "Projekt erfassen",
      addressLabel: "Adresse oder PLZ",
      addressHint: "Bestimmt Bundesland (Baurecht) und Netzbetreiber.",
      addressPlaceholder: "z. B. 38106 Braunschweig",
      projectLabel: "Vorhaben",
      buildingType: "Gebäudetyp",
      buildingTypes: {
        single_family: "Einfamilienhaus",
        two_family: "Zweifamilienhaus",
        multi_family: "Mehrfamilienhaus",
      },
      consumption: "Verbrauch (kWh/a)",
      roofArea: "Dachfläche (m²)",
      roofAreaHint: "Alternativ direkt die geplante kWp angeben.",
      plannedPv: "geplante PV (kWp)",
      orientation: "Ausrichtung (° Azimut)",
      orientationHint: "180 = Süd, 90 = Ost, 270 = West.",
      roofPitch: "Dachneigung (°)",
      wallboxKw: "Wallbox (kW)",
      wallboxKwHint: "Über 11 kW ist eine Genehmigung des Netzbetreibers nötig.",
      shading: "Verschattung",
      shadingOptions: { none: "keine", low: "gering", medium: "mittel", high: "hoch" },
      extendExisting: "Bestehende PV-Anlage erweitern",
      commissioning: "Inbetriebnahme Bestandsanlage",
      commissioningHint: "Entscheidet, welche Vergütungs-/Steuerungsregeln gelten.",
      analyze: "Analysieren",
      analyzing: "Analysiere…",
      example: "Beispiel",
      disclaimerPre: "Prototyp · Quellenbasierte Orientierung, ",
      disclaimerStrong: "nicht rechtsverbindlich",
      disclaimerPost: ". Keine vollständige Fachplanung. Datenbasis Braunschweig / BS|Netz / Niedersachsen.",
    },
    backendError: (e) => `Backend nicht erreichbar (${e}). Läuft das Backend auf :8000?`,
    analyzeQuestion: (m) =>
      `Welche Regeln, Pflichten und nächsten Schritte gelten für mein Vorhaben (${m || "PV"}) an diesem Standort?`,
    empty: {
      pre: "Erfassen Sie Ihr Projekt links und klicken Sie ",
      analyzeStrong: "Analysieren",
      post: ". Sie erhalten eine quellenbasierte Einschätzung mit aktuellen Regeln, einer technischen Ersteinschätzung und nächsten Schritten.",
      tip: "Tipp: „Beispiel“ lädt ein Einfamilienhaus in Braunschweig.",
    },
    results: {
      techAssessment: "Technische Ersteinschätzung",
      pdfOnePager: "PDF-Onepager",
      metricCapacity: "Leistung",
      metricYield: "Jahresertrag (grob)",
      metricYieldHint: "Erste Orientierung, keine Ertragsprognose.",
      metricAutarky: "Autarkie (grob)",
      metricAutarkyHint: "Anteil des Verbrauchs, der rechnerisch selbst gedeckt wird.",
      gridOperator: "Netzbetreiber",
      clarifyingTitle: "Rückfragen für eine genauere Einschätzung",
      answerTitle: "Quellenbasierte Einschätzung",
      fromCache: "aus Cache",
      rulesGlance: "Regeln auf einen Blick",
      systemOverview: "Anlagenüberblick (objektzentriert)",
      location: "Standort",
      sources: "Quellen & Rechtsstand",
      roofVision: "KI-Potenzialanalyse Dach (Plausibilisierung)",
      nextSteps: "Nächste Schritte",
      openPoints: "Offene Punkte zur Klärung",
      installerQuestions: "Fragen an den Fachbetrieb",
    },
    status: {
      valid: "Gilt aktuell",
      announced: "Angekündigt",
      expired: "Veraltet",
      unclear: "Unklar",
    },
    suitability: {
      good: "gut geeignet",
      moderate: "bedingt geeignet",
      limited: "eingeschränkt",
      unknown: "unbekannt",
    },
    pvSuitability: "PV-Eignung",
    houseDiagram: {
      solararray: "PV-Module",
      inverter: "Wechselrichter",
      battery: "Speicher",
      meterbox: "Zählerschrank",
      surgeprotector: "Überspannungsschutz",
      grounding: "Erdung",
      wallbox: "Wallbox",
      heatpump: "Wärmepumpe",
      router: "Smart Meter / Gateway",
    },
    source: { asOf: "Stand:", sourcePrefix: "Quelle:" },
    roofVision: {
      imgAlt: "Beispiel-Luftbild Dach",
      descPre: "KI-Schätzung der Modulzahl aus einem Luftbild — als ",
      descStrong: "Zusatz-Plausibilisierung",
      descPost: ", nicht als verbindliche Auslegung.",
      analyzeExample: "Beispiel-Dach analysieren",
      analyzing: "Analysiere…",
      ownImage: "Eigenes Bild",
      estimatePre: "Grobe Schätzung: ~",
      modulesWord: "Module",
    },
    onePager: {
      noData: "Keine Projektdaten gefunden. Bitte zuerst im Assistenten analysieren.",
      printButton: "Drucken / als PDF speichern",
      title: "KI-PV-Assistent — Projekt-Onepager",
      objectFallback: "Objekt",
      asOf: "Stand:",
      notLegallyBinding: "nicht rechtsverbindlich",
      plannedMeasures: "Geplante Maßnahmen",
      techAssessment: "Technische Ersteinschätzung",
      kvPvSuitability: "PV-Eignung",
      kvCapacity: "Leistung",
      kvYield: "Jahresertrag",
      kvAutarky: "Autarkie",
      yieldNote: "Grobe Orientierung, keine Ertragsprognose.",
      regulatory: "Relevante regulatorische Anforderungen",
      ruleAsOf: "Stand",
      openPoints: "Offene Punkte zur Prüfung",
      nextSteps: "Empfohlene nächste Schritte",
      footer: "Erstellt mit dem KI-PV-Assistenten (Prototyp, KI-Hackathon Energie 26). Quellenbasierte Orientierung, keine Rechtsberatung und keine vollständige Fachplanung. Maßgeblich sind die Originalquellen und die Prüfung durch einen Fachbetrieb.",
    },
  },
  en: {
    header: {
      title: "AI PV Assistant",
      subtitle: "Source-based guidance for PV, battery storage, wallbox & heat pump",
      notLegallyBinding: "not legally binding",
    },
    measures: {
      pv: "PV system",
      battery: "Battery storage",
      wallbox: "Wallbox",
      heatpump: "Heat pump",
    },
    form: {
      captureProject: "Capture project",
      addressLabel: "Address or postal code",
      addressHint: "Determines the federal state (building law) and grid operator.",
      addressPlaceholder: "e.g. 38106 Braunschweig",
      projectLabel: "Project",
      buildingType: "Building type",
      buildingTypes: {
        single_family: "Single-family house",
        two_family: "Two-family house",
        multi_family: "Multi-family house",
      },
      consumption: "Consumption (kWh/yr)",
      roofArea: "Roof area (m²)",
      roofAreaHint: "Alternatively, enter the planned kWp directly.",
      plannedPv: "Planned PV (kWp)",
      orientation: "Orientation (° azimuth)",
      orientationHint: "180 = South, 90 = East, 270 = West.",
      roofPitch: "Roof pitch (°)",
      wallboxKw: "Wallbox (kW)",
      wallboxKwHint: "Above 11 kW, approval from the grid operator is required.",
      shading: "Shading",
      shadingOptions: { none: "none", low: "low", medium: "medium", high: "high" },
      extendExisting: "Extend existing PV system",
      commissioning: "Commissioning of existing system",
      commissioningHint: "Determines which remuneration/control rules apply.",
      analyze: "Analyze",
      analyzing: "Analyzing…",
      example: "Example",
      disclaimerPre: "Prototype · Source-based guidance, ",
      disclaimerStrong: "not legally binding",
      disclaimerPost: ". Not a complete professional plan. Data basis: Braunschweig / BS|Netz / Niedersachsen.",
    },
    backendError: (e) => `Backend not reachable (${e}). Is the backend running on :8000?`,
    analyzeQuestion: (m) =>
      `Which rules, obligations and next steps apply to my project (${m || "PV"}) at this location?`,
    empty: {
      pre: "Capture your project on the left and click ",
      analyzeStrong: "Analyze",
      post: ". You will receive a source-based assessment with current rules, an initial technical assessment and next steps.",
      tip: "Tip: “Example” loads a single-family house in Braunschweig.",
    },
    results: {
      techAssessment: "Initial technical assessment",
      pdfOnePager: "PDF one-pager",
      metricCapacity: "Capacity",
      metricYield: "Annual yield (rough)",
      metricYieldHint: "Initial orientation, not a yield forecast.",
      metricAutarky: "Self-sufficiency (rough)",
      metricAutarkyHint: "Share of consumption that is covered by self-generation in the calculation.",
      gridOperator: "Grid operator",
      clarifyingTitle: "Follow-up questions for a more precise assessment",
      answerTitle: "Source-based assessment",
      fromCache: "from cache",
      rulesGlance: "Rules at a glance",
      systemOverview: "System overview (object-centered)",
      location: "Location",
      sources: "Sources & legal status",
      roofVision: "AI roof potential analysis (plausibility check)",
      nextSteps: "Next steps",
      openPoints: "Open points to clarify",
      installerQuestions: "Questions for the installer",
    },
    status: {
      valid: "Currently valid",
      announced: "Announced",
      expired: "Outdated",
      unclear: "Unclear",
    },
    suitability: {
      good: "well suited",
      moderate: "moderately suited",
      limited: "limited",
      unknown: "unknown",
    },
    pvSuitability: "PV suitability",
    houseDiagram: {
      solararray: "PV modules",
      inverter: "Inverter",
      battery: "Battery",
      meterbox: "Meter cabinet",
      surgeprotector: "Surge protection",
      grounding: "Grounding",
      wallbox: "Wallbox",
      heatpump: "Heat pump",
      router: "Smart Meter / Gateway",
    },
    source: { asOf: "As of:", sourcePrefix: "Source:" },
    roofVision: {
      imgAlt: "Example aerial roof image",
      descPre: "AI estimate of the number of modules from an aerial image — as an ",
      descStrong: "additional plausibility check",
      descPost: ", not as a binding interpretation.",
      analyzeExample: "Analyze example roof",
      analyzing: "Analyzing…",
      ownImage: "Own image",
      estimatePre: "Rough estimate: ~",
      modulesWord: "modules",
    },
    onePager: {
      noData: "No project data found. Please run an analysis in the assistant first.",
      printButton: "Print / save as PDF",
      title: "AI PV Assistant — Project one-pager",
      objectFallback: "Object",
      asOf: "As of:",
      notLegallyBinding: "not legally binding",
      plannedMeasures: "Planned measures",
      techAssessment: "Initial technical assessment",
      kvPvSuitability: "PV suitability",
      kvCapacity: "Capacity",
      kvYield: "Annual yield",
      kvAutarky: "Self-sufficiency",
      yieldNote: "Rough orientation, not a yield forecast.",
      regulatory: "Relevant regulatory requirements",
      ruleAsOf: "As of",
      openPoints: "Open points to review",
      nextSteps: "Recommended next steps",
      footer: "Created with the AI PV Assistant (prototype, AI Hackathon Energie 26). Source-based guidance, not legal advice and not a complete professional plan. The original sources and a review by a specialist company are authoritative.",
    },
  },
};

export function localizeRule(
  rule: KBRule,
  lang: Lang,
): { title: string; statement: string; uncertainties: string[]; review_needed?: string | null } {
  if (lang === "de") {
    return {
      title: rule.title_de || rule.title,
      statement: rule.statement_de || rule.statement,
      uncertainties:
        rule.uncertainties_de && rule.uncertainties_de.length ? rule.uncertainties_de : rule.uncertainties,
      review_needed: rule.review_needed_de || rule.review_needed,
    };
  }
  return {
    title: rule.title,
    statement: rule.statement,
    uncertainties: rule.uncertainties,
    review_needed: rule.review_needed,
  };
}
