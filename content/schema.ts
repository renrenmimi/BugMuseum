/* ============================================================
   The exhibit model.

   Everything a visitor reads on an exhibit page comes from one of
   these objects. Adding a museum piece means writing one more file
   in content/exhibits and registering a simulation id — no page,
   route or layout work.

   Two kinds of rule are enforced here, both by tests:

   1. Completeness — an exhibit that is missing its root cause, or
      claims a first fix without explaining why it was not enough,
      is not an exhibit.
   2. Privacy — the debugging cases in this museum came out of real
      project work, and the projects themselves are not the point.
      An exhibit describes the technical context it happened in and
      links only to artifacts inside this repository. See
      findPrivacyIssues() for how that is checked without this file
      naming anything it is trying to keep out.
   ============================================================ */

export const STATE_KEYS = ["broken", "first-fix", "fixed"] as const;
export type StateKey = (typeof STATE_KEYS)[number];

export const CATEGORIES = [
  "state",
  "async",
  "browser",
  "concurrency",
  "testing",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  state: "State",
  async: "Async",
  browser: "Browser",
  concurrency: "Concurrency",
  testing: "Testing",
};

/** Every simulation is a component registered in components/sims/registry.tsx. */
export const SIMULATIONS = [
  "drawer-scroll-lock",
  "circuit-breaker",
  "local-day",
  "restart-loop",
  "two-tabs",
  "double-submit",
] as const;
export type SimulationId = (typeof SIMULATIONS)[number];

/**
 * The technical setting a case came out of, described by what it is rather
 * than what it was called. These are the only labels an exhibit may use.
 */
export const CONTEXT_LABELS = [
  "Learning interface",
  "API resilience layer",
  "Daily practice tracker",
  "Voice session",
  "Multi-tab account flow",
  "Guided coding exercise",
] as const;
export type ContextLabel = (typeof CONTEXT_LABELS)[number];

export interface ExhibitContext {
  label: ContextLabel;
  /** One sentence on the kind of software this happened in. */
  description: string;
}

/**
 * Every source link points at something in this repository, because that is
 * the only provenance a visitor can actually check.
 */
export type SourceKind =
  | "exhibit-definition"
  | "simulation"
  | "simulation-logic"
  | "regression-test"
  | "commit";

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  "exhibit-definition": "Exhibit data",
  simulation: "Simulation",
  "simulation-logic": "Logic",
  "regression-test": "Test",
  commit: "Commit",
};

export interface SourceLink {
  kind: SourceKind;
  /** What the visitor is about to open, in their words. */
  label: string;
  href: string;
  /** Optional one-line note about what this link shows. */
  note?: string;
}

export type ExcerptKind = "diff" | "code";

/**
 * Where an excerpt's text comes from, stated rather than implied.
 *
 * - "reproduction": a minimal, generic rewrite of the pattern being described.
 *   It is not copied from anywhere and is not presented as a quotation.
 * - "museum-source": copied from a file in this repository, which is linked.
 */
export type ExcerptOrigin = "reproduction" | "museum-source";

export interface CodeExcerpt {
  caption: string;
  kind: ExcerptKind;
  language: "tsx" | "ts" | "css" | "text";
  /**
   * Diff lines carry a leading "+", "-" or " ". Code lines are verbatim.
   * Kept as an array so no template literal has to survive prettier.
   */
  lines: readonly string[];
  origin: ExcerptOrigin;
  /** Required for "museum-source": the file it was copied from. */
  href?: string;
}

export interface ExhibitStateCard {
  key: StateKey;
  /** "Broken", "First fix", "Fixed" — short, it sits in a segmented control. */
  label: string;
  /** One line: what the visitor is about to see. */
  headline: string;
  /** Two or three things to try in this state. */
  tryThis: readonly string[];
}

export type TimelinePhase =
  | "discovered"
  | "attempted"
  | "fixed"
  | "regression-test";

export const TIMELINE_PHASES: readonly TimelinePhase[] = [
  "discovered",
  "attempted",
  "fixed",
  "regression-test",
];

export const TIMELINE_PHASE_LABELS: Record<TimelinePhase, string> = {
  discovered: "Observed",
  attempted: "First fix",
  fixed: "Final fix",
  "regression-test": "Pinned by a test",
};

export interface TimelineEntry {
  phase: TimelinePhase;
  title: string;
  detail: string;
  source?: SourceLink;
}

export interface RegressionTest {
  /** Prose: what the test actually asserts, and why it cannot pass vacuously. */
  intro: readonly string[];
  excerpt: CodeExcerpt;
}

export interface Exhibit {
  slug: string;
  /** Gallery number. Unique, 1-based, stable once published. */
  number: number;
  title: string;
  /** Exactly one sentence. */
  summary: string;
  context: ExhibitContext;
  categories: readonly Category[];
  tech: readonly string[];
  simulation: SimulationId;
  /** Always starts with "broken" and ends with "fixed". */
  states: readonly ExhibitStateCard[];
  whatHappened: readonly string[];
  rootCause: readonly string[];
  /** Required exactly when a "first-fix" state exists. */
  whyFirstFixFailed?: readonly string[];
  test: RegressionTest;
  excerpts: readonly CodeExcerpt[];
  timeline: readonly TimelineEntry[];
  sources: readonly SourceLink[];
  /** One line: what a visitor can check here, on this site. */
  evidence: string;
  /** What the simulation reproduces rather than runs. Never omitted. */
  simulationNote: string;
  featured?: boolean;
}

/* ------------------------------------------------------------
   Link rules

   A source link is either somewhere on this site, or a file in this
   repository. Nothing else is allowed — in particular, a link to a
   different repository under the same owner is a failure, not a
   near miss.
   ------------------------------------------------------------ */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MUSEUM_REPO = "https://github.com/renrenmimi/BugMuseum";
const MUSEUM_LINK = new RegExp(`^${MUSEUM_REPO}(?:/|$)`);
const SITE_RELATIVE = /^\/(?![/\\])/;
const OWNER_LINK = /https:\/\/github\.com\/renrenmimi\/([A-Za-z0-9._-]+)/g;

export function isAllowedHref(href: string): boolean {
  return SITE_RELATIVE.test(href) || MUSEUM_LINK.test(href);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/* ------------------------------------------------------------
   Privacy rules

   Deliberately expressed as patterns rather than as a list of the
   names being kept out: a deny-list would put those names back into
   a tracked file, which is the thing being avoided. The patterns
   below catch the shapes that leak provenance.
   ------------------------------------------------------------ */

/** A bare commit hash. Seven to forty hex characters, on its own. */
const BARE_SHA = /\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/g;

/** Pull-request references, in the three shapes people write them. */
const PR_REFERENCE = /\b(?:PR|pull request)\s*#\s*\d+|\/pull\/\d+/gi;

/**
 * Words with an internal capital: the shape a product name takes. Technology
 * names are allowed by name; anything else has to be added here on purpose,
 * which is the point — a new product name trips this rather than shipping.
 */
const INTERNAL_CAPITAL = /\b[A-Z][a-z]+(?:[A-Z][a-z]*)+\b/g;

const ALLOWED_NAMES: readonly string[] = [
  // this project, and where it lives
  "BugMuseum",
  "GitHub",
  // languages, runtimes, libraries, tools
  "TypeScript",
  "JavaScript",
  "NextJs",
  "OpenGraph",
  // browser and platform APIs referred to by name
  "SpeechRecognition",
  "IntersectionObserver",
  "ResizeObserver",
  "StrictMode",
  // library and language types that appear in the reproductions
  "ReturnType",
  "FormEvent",
  "ReactNode",
  // identifiers that appear in the reproductions
  "CircuitBreaker",
  "BreakerOpenError",
  "AuthContext",
  "UserProfile",
  "HttpsError",
  // this project's own exports, quoted in the test excerpts
  "SimEndpoint",
  "SimBreaker",
];

export interface PrivacyIssue {
  field: string;
  problem: string;
}

/**
 * Scans one piece of text for anything that would identify where a case came
 * from. Exported so the same rules can be run over the README and over
 * rendered pages, not just over exhibit data.
 */
export function findTextPrivacyIssues(
  text: string,
  field: string,
): PrivacyIssue[] {
  const issues: PrivacyIssue[] = [];

  for (const [, repo] of text.matchAll(OWNER_LINK)) {
    if (repo !== "BugMuseum") {
      issues.push({
        field,
        problem: `links to another repository under the same owner: ${repo}`,
      });
    }
  }

  for (const match of text.matchAll(BARE_SHA)) {
    issues.push({ field, problem: `looks like a commit hash: ${match[0]}` });
  }

  for (const match of text.matchAll(PR_REFERENCE)) {
    issues.push({
      field,
      problem: `references a pull request elsewhere: ${match[0].trim()}`,
    });
  }

  for (const match of text.matchAll(INTERNAL_CAPITAL)) {
    const word = match[0];
    if (!ALLOWED_NAMES.includes(word)) {
      issues.push({
        field,
        problem: `reads like a product name: ${word} (add it to ALLOWED_NAMES if it is a technology)`,
      });
    }
  }

  return issues;
}

/** Every string an exhibit renders, paired with where it came from. */
export function exhibitStrings(exhibit: Exhibit): [string, string][] {
  const out: [string, string][] = [
    ["title", exhibit.title],
    ["summary", exhibit.summary],
    ["context.label", exhibit.context.label],
    ["context.description", exhibit.context.description],
    ["evidence", exhibit.evidence],
    ["simulationNote", exhibit.simulationNote],
  ];

  exhibit.tech.forEach((t, i) => out.push([`tech[${i}]`, t]));
  exhibit.whatHappened.forEach((p, i) => out.push([`whatHappened[${i}]`, p]));
  exhibit.rootCause.forEach((p, i) => out.push([`rootCause[${i}]`, p]));
  (exhibit.whyFirstFixFailed ?? []).forEach((p, i) =>
    out.push([`whyFirstFixFailed[${i}]`, p]),
  );
  exhibit.test.intro.forEach((p, i) => out.push([`test.intro[${i}]`, p]));

  exhibit.states.forEach((s) => {
    out.push([`states.${s.key}.headline`, s.headline]);
    s.tryThis.forEach((t, i) => out.push([`states.${s.key}.tryThis[${i}]`, t]));
  });

  for (const excerpt of [...exhibit.excerpts, exhibit.test.excerpt]) {
    out.push([`excerpt "${excerpt.caption}".caption`, excerpt.caption]);
    excerpt.lines.forEach((line, i) =>
      out.push([`excerpt "${excerpt.caption}".lines[${i}]`, line]),
    );
    if (excerpt.href) out.push([`excerpt "${excerpt.caption}".href`, excerpt.href]);
  }

  exhibit.timeline.forEach((entry, i) => {
    out.push([`timeline[${i}].title`, entry.title]);
    out.push([`timeline[${i}].detail`, entry.detail]);
    if (entry.source) {
      out.push([`timeline[${i}].source.label`, entry.source.label]);
      out.push([`timeline[${i}].source.href`, entry.source.href]);
    }
  });

  exhibit.sources.forEach((source, i) => {
    out.push([`sources[${i}].label`, source.label]);
    out.push([`sources[${i}].href`, source.href]);
    if (source.note) out.push([`sources[${i}].note`, source.note]);
  });

  return out;
}

/** Privacy problems in one exhibit. Empty means clean. */
export function findPrivacyIssues(exhibit: Exhibit): PrivacyIssue[] {
  return exhibitStrings(exhibit).flatMap(([field, text]) =>
    findTextPrivacyIssues(text, `${exhibit.slug}.${field}`),
  );
}

/* ------------------------------------------------------------
   Completeness validation
   ------------------------------------------------------------ */

/**
 * Returns the list of problems with one exhibit. Empty means valid.
 * Deliberately returns every problem rather than throwing on the first:
 * fixing exhibits one message at a time is how you lose an evening.
 */
export function validateExhibit(exhibit: Exhibit): string[] {
  const problems: string[] = [];
  const at = (msg: string) => problems.push(`${exhibit.slug || "?"}: ${msg}`);

  if (!SLUG.test(exhibit.slug)) at("slug must be kebab-case");
  if (!Number.isInteger(exhibit.number) || exhibit.number < 1) {
    at("number must be a positive integer");
  }
  if (!isNonEmptyString(exhibit.title)) at("title is required");

  if (!isNonEmptyString(exhibit.summary)) {
    at("summary is required");
  } else {
    const sentences = exhibit.summary
      .split(/(?<=[.?!])\s+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length !== 1) at("summary must be exactly one sentence");
    if (!/[.?!]$/.test(exhibit.summary.trim())) {
      at("summary must end with punctuation");
    }
    if (exhibit.summary.length > 190) at("summary is too long for a card");
  }

  /* These two are rendered as plain text — in <title>, in og:description
     and in a card heading — so markers would leak through verbatim. */
  for (const [name, value] of [
    ["title", exhibit.title],
    ["summary", exhibit.summary],
  ] as const) {
    if (/[`]|\*\*/.test(value)) at(`${name} must not contain markup`);
  }

  if (!isNonEmptyString(exhibit.evidence)) at("evidence line is required");
  if (!isNonEmptyString(exhibit.simulationNote)) {
    at("simulationNote is required — say what is reproduced, not run");
  }

  /* --- context --- */
  if (!CONTEXT_LABELS.includes(exhibit.context.label)) {
    at(`context.label must be one of the approved labels`);
  }
  if (!isNonEmptyString(exhibit.context.description)) {
    at("context.description is required");
  }

  if (exhibit.categories.length === 0) at("at least one category is required");
  for (const c of exhibit.categories) {
    if (!CATEGORIES.includes(c)) at(`unknown category "${c}"`);
  }
  if (new Set(exhibit.categories).size !== exhibit.categories.length) {
    at("duplicate category");
  }

  if (exhibit.tech.length === 0) at("at least one technology tag is required");

  if (!SIMULATIONS.includes(exhibit.simulation)) {
    at(`unknown simulation "${exhibit.simulation}"`);
  }

  /* --- states --- */
  const keys = exhibit.states.map((s) => s.key);
  if (keys[0] !== "broken") at("the first state must be broken");
  if (keys[keys.length - 1] !== "fixed") at("the last state must be fixed");
  if (new Set(keys).size !== keys.length) at("duplicate state");
  if (keys.length < 2 || keys.length > 3) at("expected two or three states");
  for (const s of exhibit.states) {
    if (!isNonEmptyString(s.label)) at(`state ${s.key} needs a label`);
    if (!isNonEmptyString(s.headline)) at(`state ${s.key} needs a headline`);
    if (s.tryThis.length < 2) at(`state ${s.key} needs at least two things to try`);
  }

  const hasFirstFix = keys.includes("first-fix");
  if (hasFirstFix && !exhibit.whyFirstFixFailed?.length) {
    at("a first-fix state requires whyFirstFixFailed");
  }
  if (!hasFirstFix && exhibit.whyFirstFixFailed?.length) {
    at("whyFirstFixFailed without a first-fix state");
  }

  /* --- prose --- */
  if (exhibit.whatHappened.length === 0) at("whatHappened is required");
  if (exhibit.rootCause.length === 0) at("rootCause is required");
  if (exhibit.test.intro.length === 0) at("the test needs an explanation");

  /* --- code --- */
  const allExcerpts = [...exhibit.excerpts, exhibit.test.excerpt];
  if (exhibit.excerpts.length === 0) at("at least one code excerpt is required");
  for (const ex of allExcerpts) {
    if (!isNonEmptyString(ex.caption)) at("an excerpt is missing its caption");
    if (ex.lines.length === 0) at(`excerpt "${ex.caption}" is empty`);
    if (ex.origin === "museum-source" && !ex.href) {
      at(`excerpt "${ex.caption}" is quoted from here and must link to the file`);
    }
    if (ex.href && !isAllowedHref(ex.href)) {
      at(`excerpt "${ex.caption}" may only link inside this project`);
    }
    if (ex.kind === "diff") {
      const bad = ex.lines.find((l) => !/^[-+ ]/.test(l) && l.length > 0);
      if (bad !== undefined) {
        at(`diff line without a +/-/space marker in "${ex.caption}"`);
      }
      if (!ex.lines.some((l) => l.startsWith("-"))) {
        at(`diff "${ex.caption}" has no removed line`);
      }
      if (!ex.lines.some((l) => l.startsWith("+"))) {
        at(`diff "${ex.caption}" has no added line`);
      }
    }
    /* A code column that wide overflows the case on a 360px phone. */
    const overlong = ex.lines.find((l) => l.length > 84);
    if (overlong !== undefined) {
      at(`a line in "${ex.caption}" is ${overlong.length} chars — wrap it`);
    }
  }

  /* --- timeline: the whole point of the museum --- */
  const phases = exhibit.timeline.map((t) => t.phase);
  if (!phases.includes("discovered")) at("timeline needs an observation");
  if (!phases.includes("fixed")) at("timeline needs a final fix");
  if (!phases.includes("regression-test")) at("timeline needs a regression test");
  if (hasFirstFix && !phases.includes("attempted")) {
    at("a first-fix state needs an attempted-fix timeline entry");
  }
  const order = phases.map((p) => TIMELINE_PHASES.indexOf(p));
  for (let i = 1; i < order.length; i += 1) {
    if ((order[i] ?? 0) < (order[i - 1] ?? 0)) at("timeline runs out of order");
  }

  /* --- sources: only things a visitor can open and check --- */
  if (exhibit.sources.length < 3) at("at least three source links are required");
  for (const s of exhibit.sources) {
    if (!isNonEmptyString(s.label)) at("a source link is missing its label");
    if (!isAllowedHref(s.href)) {
      at(`source "${s.label}" may only link inside this project`);
    }
  }
  const kinds = new Set(exhibit.sources.map((s) => s.kind));
  for (const required of [
    "exhibit-definition",
    "simulation",
    "regression-test",
  ] as const) {
    if (!kinds.has(required)) at(`sources must include the ${required}`);
  }

  return problems;
}

/** Validates the whole gallery, including cross-exhibit uniqueness. */
export function validateGallery(exhibits: readonly Exhibit[]): string[] {
  const problems = exhibits.flatMap(validateExhibit);

  const slugs = new Set<string>();
  const numbers = new Set<number>();
  const labels = new Set<string>();
  for (const e of exhibits) {
    if (slugs.has(e.slug)) problems.push(`duplicate slug "${e.slug}"`);
    if (numbers.has(e.number)) problems.push(`duplicate number ${e.number}`);
    if (labels.has(e.context.label)) {
      problems.push(`duplicate context label "${e.context.label}"`);
    }
    slugs.add(e.slug);
    numbers.add(e.number);
    labels.add(e.context.label);
  }

  const featured = exhibits.filter((e) => e.featured);
  if (featured.length !== 1) {
    problems.push(`expected exactly one featured exhibit, found ${featured.length}`);
  }

  return problems;
}
