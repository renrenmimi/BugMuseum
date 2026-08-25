/* ============================================================
   The exhibit model.

   Everything a visitor reads on an exhibit page comes from one of
   these objects. Adding a museum piece means writing one more file
   in content/exhibits and registering a simulation id — no page,
   route or layout work.

   The validator below is not decoration: a museum about bugs that
   ships a malformed exhibit would be embarrassing, so the rules are
   enforced by tests (tests/unit/exhibits.test.ts).
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

export type SourceKind = "pull-request" | "commit" | "file" | "repository";

export interface SourceLink {
  kind: SourceKind;
  /** What the visitor is about to open, in their words. */
  label: string;
  href: string;
  /** Optional one-line note about what this link proves. */
  note?: string;
}

export type ExcerptKind = "diff" | "code";

export interface CodeExcerpt {
  /** "components/app-shell.tsx — the restore" */
  caption: string;
  kind: ExcerptKind;
  language: "tsx" | "ts" | "css" | "text";
  /**
   * Diff lines carry a leading "+", "-" or " ". Code lines are verbatim.
   * Kept as an array so no template literal has to survive prettier.
   */
  lines: readonly string[];
  /** Where this excerpt was copied from. Required for verbatim quotes. */
  href?: string;
  /** True when the text is quoted from the source repository unchanged. */
  verbatim: boolean;
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
  discovered: "Discovered",
  attempted: "Attempted fix",
  fixed: "Final fix",
  "regression-test": "Regression test",
};

export interface TimelineEntry {
  phase: TimelinePhase;
  title: string;
  detail: string;
  source?: SourceLink;
}

export interface Project {
  name: string;
  /** owner/repo */
  repo: string;
  href: string;
  /** One line about what the project is, for visitors who have not seen it. */
  blurb: string;
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
  project: Project;
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
  /** One line naming the artefact that proves this happened. */
  evidence: string;
  /** What the simulation reproduces rather than runs. Never omitted. */
  simulationNote: string;
  featured?: boolean;
}

/* ------------------------------------------------------------
   Validation
   ------------------------------------------------------------ */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GITHUB_SOURCE = /^https:\/\/github\.com\/renrenmimi\/[A-Za-z0-9._-]+/;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

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
  /* These two are rendered as plain text — in <title>, in og:description
     and in a card heading — so markers would leak through verbatim. */
  for (const [name, value] of [
    ["title", exhibit.title],
    ["summary", exhibit.summary],
  ] as const) {
    if (/[`]|\*\*/.test(value)) at(`${name} must not contain markup`);
  }

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

  if (!isNonEmptyString(exhibit.evidence)) at("evidence line is required");
  if (!isNonEmptyString(exhibit.simulationNote)) {
    at("simulationNote is required — say what is reproduced, not run");
  }

  if (!GITHUB_SOURCE.test(exhibit.project.href)) {
    at("project.href must be a github.com/renrenmimi URL");
  }
  if (!isNonEmptyString(exhibit.project.blurb)) at("project.blurb is required");

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
    if (ex.verbatim && !ex.href) {
      at(`verbatim excerpt "${ex.caption}" must link to its source`);
    }
    if (ex.href && !GITHUB_SOURCE.test(ex.href)) {
      at(`excerpt "${ex.caption}" must link to github.com/renrenmimi`);
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
  if (!phases.includes("discovered")) at("timeline needs a discovery");
  if (!phases.includes("fixed")) at("timeline needs a final fix");
  if (!phases.includes("regression-test")) at("timeline needs a regression test");
  if (hasFirstFix && !phases.includes("attempted")) {
    at("a first-fix state needs an attempted-fix timeline entry");
  }
  const order = phases.map((p) => TIMELINE_PHASES.indexOf(p));
  for (let i = 1; i < order.length; i += 1) {
    if ((order[i] ?? 0) < (order[i - 1] ?? 0)) at("timeline runs out of order");
  }

  /* --- sources --- */
  if (exhibit.sources.length < 2) at("at least two source links are required");
  for (const s of exhibit.sources) {
    if (!isNonEmptyString(s.label)) at("a source link is missing its label");
    if (!GITHUB_SOURCE.test(s.href)) {
      at(`source "${s.label}" must point at github.com/renrenmimi`);
    }
  }
  if (!exhibit.sources.some((s) => s.kind === "commit" || s.kind === "pull-request")) {
    at("at least one source must be a commit or a pull request");
  }

  return problems;
}

/** Validates the whole gallery, including cross-exhibit uniqueness. */
export function validateGallery(exhibits: readonly Exhibit[]): string[] {
  const problems = exhibits.flatMap(validateExhibit);

  const slugs = new Set<string>();
  const numbers = new Set<number>();
  for (const e of exhibits) {
    if (slugs.has(e.slug)) problems.push(`duplicate slug "${e.slug}"`);
    if (numbers.has(e.number)) problems.push(`duplicate number ${e.number}`);
    slugs.add(e.slug);
    numbers.add(e.number);
  }

  const featured = exhibits.filter((e) => e.featured);
  if (featured.length !== 1) {
    problems.push(`expected exactly one featured exhibit, found ${featured.length}`);
  }

  return problems;
}
