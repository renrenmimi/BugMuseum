import type { Exhibit } from "../schema";
import { MUSEUM_REPO } from "../schema";

const file = (path: string) => `${MUSEUM_REPO}/blob/main/${path}`;

const DEFINITION = file("content/exhibits/local-day-boundary.ts");
const SIMULATION = file("components/sims/day/day-sim.tsx");
const LOGIC = file("lib/sims/local-day.ts");
const UNIT = file("tests/unit/sims/local-day.test.ts");

export const localDayBoundary: Exhibit = {
  slug: "local-day-boundary",
  number: 3,
  title: "The day that was only 23 hours long",
  summary:
    "A streak counted backwards in fixed 24-hour steps, so just after midnight, once the clocks had gone forward, it stepped over a date and came up one day short.",
  context: {
    label: "Daily practice tracker",
    description:
      "A feature that serves one drill a day and counts how many consecutive days you have cleared the day’s drill.",
  },
  categories: ["testing", "state"],
  tech: ["TypeScript", "Dates & time zones", "Vitest"],
  simulation: "local-day",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "Walking back 86,400,000ms at a time skips or repeats the date on which the clocks change, so the streak comes out wrong.",
      tryThis: [
        "In Spring forward, set the clock to 00:30 on 10 March — just after midnight, two days after the clocks went forward.",
        "Watch the walk step over 2026-03-08 and come up one day short; at 09:00 the same day the bug disappears.",
        "Switch to Fall back at 23:30: the 25-hour day is counted twice.",
      ],
    },
    {
      key: "first-fix",
      label: "First fix",
      headline:
        "Stepping the calendar date fixes the streak, but the drill still changes in the late afternoon, not at midnight.",
      tryThis: [
        "Re-run the same walks: every date is now visited exactly once.",
        "Then look at the second panel, which asks the same question a different way.",
        "Drag the clock into the late afternoon and watch today’s drill change hours before midnight.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "Both answers to “what day is it” now come from the same local calendar.",
      tryThis: [
        "Sweep the clock across the whole day: the second panel stays one colour, because the drill now changes only at local midnight.",
        "Check the spring-forward and fall-back walks again.",
        "Read the verdict under the second panel: the drill now changes at the same midnight as the cleared badge and the streak key.",
      ],
    },
  ],

  whatHappened: [
    "The feature served one drill a day. Clearing it marked the local date, and a streak counter walked backwards from today counting consecutive cleared dates.",
    "The walk subtracted a fixed 86,400,000 milliseconds per step. The dates it compared against were produced by a helper that read local calendar fields. Those two agree on almost every day of the year — and disagree on the two when the clocks change.",
    "On a spring-forward day the local day is 23 hours long. Stepping back a full 24 hours across it lands one wall-clock hour earlier than intended — from 00:30 on 9 March to 23:30 on 7 March — so 8 March is never visited at all. Checked at 00:30 on 10 March, 2026-03-08 vanished from the walk and an intact five-day streak was counted as four.",
    "The calendar-stepping fix was correct. A later pass found the same question answered a second way one file over: the code that picked which drill to serve used `Math.floor(now / 86_400_000)` — UTC days. Seven or eight hours west of UTC, the drill therefore changed at four or five in the afternoon, resetting the cleared badge and offering the same person a second drill for the same calendar day.",
  ],

  rootCause: [
    "A day is not a duration. `86_400_000` is a length of time; a date is a position on somebody’s calendar. Mixing the two works for 363 days a year, which is long enough for the mistake to feel safe.",
    "`Date.prototype.setDate()` steps local calendar fields and is DST-correct by construction — it is the only arithmetic here that asks the same question the data was recorded with.",
    "The second half of the bug is subtler and more common: the codebase had two definitions of “today” living in different files. A fix that corrects one of them leaves the system inconsistent in a new way, which is often harder to see than the original defect.",
  ],

  whyFirstFixFailed: [
    "The first fix did not fail. It fixed the streak, and the streak has stayed fixed.",
    "What it did not do was ask whether anything else in the feature had its own idea of what day it was. The cleared badge and the streak key both read the local calendar; the drill rotation counted UTC days since the epoch. Correcting the walk made the mismatch harder to see in one specific sense: the streak was now right, so a drill rotating in the late afternoon looked like a completely unrelated problem.",
    "The complete fix replaces the UTC day index with a local one, so the drill rotates at exactly the midnight the cleared badge and the streak roll over on. Switch to Fixed and sweep the clock: the second panel goes to one colour.",
  ],

  excerpts: [
    {
      caption: "The walk",
      kind: "diff",
      language: "ts",
      origin: "reproduction",
      lines: [
        " function streakLength(now: number, done: Set<string>): number {",
        "-  // Today may not be done yet; that alone does not end the run.",
        "-  let count = 0;",
        "-  for (let i = done.has(dateKey(now)) ? 0 : 1; ; i += 1) {",
        "-    if (!done.has(dateKey(now - i * 86_400_000))) return count;",
        "-    count += 1;",
        "-  }",
        "+  // Step the calendar, not the clock: twice a year a day lasts 23 or 25",
        "+  // hours, and a fixed 86_400_000 ms skips or repeats a date.",
        "+  const day = new Date(now);",
        "+  // An unfinished today does not end the run, so start from yesterday.",
        "+  if (!done.has(dateKey(day.getTime()))) day.setDate(day.getDate() - 1);",
        "+  let count = 0;",
        "+  while (done.has(dateKey(day.getTime()))) {",
        "+    count += 1;",
        "+    day.setDate(day.getDate() - 1);",
        "+  }",
        "+  return count;",
        " }",
      ],
    },
    {
      caption: "The same question, one file over",
      kind: "diff",
      language: "ts",
      origin: "reproduction",
      lines: [
        " function drillFor(now: number): Drill {",
        "-  const dayNumber = Math.floor(now / 86_400_000); // days since 1970, in UTC",
        "+  // Count days on the local calendar, so the drill changes at the same",
        "+  // midnight as the cleared badge and the streak.",
        "+  const d = new Date(now);",
        "+  const dayNumber =",
        "+    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;",
        "   return drills[dayNumber % drills.length];",
        " }",
      ],
    },
  ],

  test: {
    intro: [
      "A daylight-saving test written the obvious way can pass for free. Continuous integration usually runs in UTC, and UTC has no transitions, so the assertions are green on a machine where the bug cannot happen.",
      "The museum sidesteps that by not depending on the host time zone at all. `lib/sims/local-day.ts` carries a small hard-coded model of one North American zone for 2026 — standard offset, daylight offset, and the two transition instants — so the exhibit and the tests behave identically for every visitor and on every runner.",
      "There are two boundary cases, not one: a 23-hour day must not be skipped, and a 25-hour day must not be counted twice. Both walk implementations are tested against both, so the broken one is pinned as broken rather than merely absent.",
    ],
    excerpt: {
      caption: "tests/unit/sims/local-day.test.ts",
      kind: "code",
      language: "ts",
      origin: "museum-source",
      href: UNIT,
      lines: [
        "it(\"skips the 23-hour day when run just after midnight\", () => {",
        "  const result = walkStreak(\"milliseconds\", at(2026, 2, 10, 0, 30), SPRING);",
        "  expect(result.skipped).toContain(\"2026-03-08\");",
        "  expect(result.streak).toBeLessThan(SPRING.length);",
        "});",
        "",
        "it(\"survives the spring-forward boundary just after midnight\", () => {",
        "  const result = walkStreak(\"calendar\", at(2026, 2, 10, 0, 30), SPRING);",
        "  expect(result.skipped).toEqual([]);",
        "  expect(result.streak).toBe(SPRING.length);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "The walk and the date keys disagreed",
      detail:
        "The streak stepped in milliseconds while the keys it compared against read local calendar fields. Reproducible in the case: Broken, spring-forward, clock at 00:30.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "attempted",
      title: "Step the calendar instead",
      detail:
        "`day.setDate(day.getDate() - 1)` is DST-correct by construction. The fall-back case matters as much as the spring-forward one, so a 25-hour day is not double-counted.",
    },
    {
      phase: "fixed",
      title: "Make the drill agree with the badge",
      detail:
        "The rotation still indexed UTC days, so in this zone the drill swapped at 16:00 or 17:00. Replaced with a local day index, so rotation, cleared badge and streak key all roll over at the same midnight.",
      source: { kind: "simulation-logic", label: "lib/sims/local-day.ts", href: LOGIC },
    },
    {
      phase: "regression-test",
      title: "Pin the zone, or the test means nothing",
      detail:
        "A hard-coded zone model, both transitions, both walk implementations, and the rotation hour sampled across a whole local day.",
      source: { kind: "regression-test", label: "tests/unit/sims/local-day.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/local-day-boundary.ts",
      href: DEFINITION,
      note: "Every word on this page, as data.",
    },
    {
      kind: "simulation",
      label: "components/sims/day/day-sim.tsx",
      href: SIMULATION,
      note: "The clock slider, the walk and the rotation strip.",
    },
    {
      kind: "simulation-logic",
      label: "lib/sims/local-day.ts",
      href: LOGIC,
      note: "The zone model, both walks and both rotation indexes.",
    },
    {
      kind: "regression-test",
      label: "tests/unit/sims/local-day.test.ts",
      href: UNIT,
      note: "Both transitions, both walks, and the rotation hour.",
    },
  ],

  evidence:
    "The zone is modelled in code rather than taken from the host, so the 23-hour and 25-hour days are reproducible here and in the tests, in any time zone.",
  simulationNote:
    "The clock in the case uses a small hard-coded model of one North American zone for 2026 (UTC-8, and UTC-7 between 8 March and 1 November) so it behaves the same for every visitor. Both walk implementations and both rotation indexes are the ones the unit tests drive.",
};
