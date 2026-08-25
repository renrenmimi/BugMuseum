import type { Exhibit } from "../schema";

const REPO = "https://github.com/renrenmimi/ToneDown";
const STREAK_FIX = `${REPO}/commit/82d995c0b5d50be135d660a71974c05215fdf49e`;
const DRILL_FIX = `${REPO}/commit/ff02395627af644b5cb54f8affb49f3b8557233b`;
const USE_GYM = `${REPO}/blob/main/src/features/drills/useGym.ts`;
const DRILLS = `${REPO}/blob/main/src/features/drills/drills.ts`;
const STREAK_TEST = `${REPO}/blob/main/src/features/drills/streak.test.ts`;

export const localDayBoundary: Exhibit = {
  slug: "local-day-boundary",
  number: 3,
  title: "The day that was only 23 hours long",
  summary:
    "A streak counted backwards in fixed 24-hour steps, so the morning after the clocks went forward it skipped a date and declared the run broken.",
  project: {
    name: "ToneDown",
    repo: "renrenmimi/ToneDown",
    href: REPO,
    blurb:
      "A speaking-tone coach with a daily rewrite drill and a streak counter.",
  },
  categories: ["testing", "state"],
  tech: ["TypeScript", "Vitest", "Dates & time zones"],
  simulation: "local-day",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "Walking back 86,400,000ms at a time skips 8 March entirely and reports a broken streak.",
      tryThis: [
        "Set the clock to 00:30 on 10 March, just after the clocks went forward.",
        "Watch the walk step over 2026-03-08 and stop one day early.",
        "Move the clock to 09:00 the same day: the bug disappears.",
      ],
    },
    {
      key: "first-fix",
      label: "First fix",
      headline:
        "Stepping the calendar date fixes the streak — and the drill still rotates at 5pm.",
      tryThis: [
        "Re-run the same 00:30 walk: every date is now visited exactly once.",
        "Then look at the second panel, which asks the same question a different way.",
        "Drag the clock past 17:00 local and watch today's drill change mid-afternoon.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "Both answers to “what day is it” now come from the same local calendar.",
      tryThis: [
        "Sweep the clock across a whole day: the drill changes only at local midnight.",
        "Check the spring-forward and fall-back walks again.",
        "Confirm the cleared badge and the drill roll over on the same tick.",
      ],
    },
  ],

  whatHappened: [
    "ToneDown has a daily rewrite drill. Clearing it marks the local date, and a streak counter walks backwards from today counting consecutive cleared dates.",
    "The walk subtracted a fixed 86,400,000 milliseconds per step. The dates it compared against were produced by `localDateKey`, which reads local calendar fields. Those two agree on almost every day of the year — and disagree on the two when the clocks change.",
    "On a spring-forward day the local day is 23 hours long. Stepping back a full 24 hours from just after midnight lands an hour before local midnight of the day before, so one date is never visited at all. Reproduced in both America/Los_Angeles and America/New_York: on 10 March at 00:30 local, 2026-03-08 vanished from the walk, and an intact five-day streak was reported as broken.",
    "The calendar-stepping fix landed and was correct. Seventeen minutes later, a review pass found the same question answered a second way one file over: `todaysDrill` picked the drill with `Math.floor(now / 86_400_000)` — UTC days. In UTC-7 the drill therefore changed at 5pm local, resetting the cleared badge mid-afternoon and offering the same person a second drill for the same calendar day.",
  ],

  rootCause: [
    "A day is not a duration. `86_400_000` is a length of time; a date is a position on somebody's calendar. Mixing the two works for 363 days a year, which is long enough for the mistake to feel safe.",
    "`Date.prototype.setDate()` steps local calendar fields and is DST-correct by construction — it is the only arithmetic here that is asking the same question the data was recorded with.",
    "The second half of the bug is subtler and more common: the codebase had two definitions of “today” living in different files. A fix that corrects one of them leaves the system inconsistent in a new way, which is often harder to see than the original defect.",
  ],

  whyFirstFixFailed: [
    "The first fix did not fail. It fixed the streak, it shipped with tests, and those tests still pass today.",
    "What it did not do was ask whether anything else in the feature had its own idea of what day it was. `clearedToday` and the streak key both read the local calendar; `todaysDrill` counted UTC days since the epoch. Correcting the walk made the mismatch worse in one specific sense — the streak was now right, so the drill rotating at 5pm looked like a completely unrelated problem.",
    "The final fix replaces the UTC day index with a local one, so the drill rotates at exactly the midnight the cleared badge and the streak roll over on.",
  ],

  excerpts: [
    {
      caption: "src/features/drills/useGym.ts — the walk",
      kind: "diff",
      language: "ts",
      verbatim: true,
      href: USE_GYM,
      lines: [
        "+  // Step the local CALENDAR date rather than subtracting 86_400_000ms:",
        "+  // a spring-forward day is only 23h long, so fixed-ms arithmetic run",
        "+  // near midnight skips a date outright and silently breaks a streak.",
        "+  const cursor = new Date(now)",
        "   for (let day = 0; ; day += 1) {",
        "-    const key = localDateKey(now - day * 86_400_000)",
        "-    if (clearedDates.has(key)) {",
        "+    if (clearedDates.has(localDateKey(cursor.getTime()))) {",
        "       streak += 1",
        "-    } else if (day === 0) {",
        "-      continue",
        "-    } else {",
        "+    } else if (day > 0) {",
        "       break",
        "     }",
        "+    cursor.setDate(cursor.getDate() - 1)",
        "   }",
      ],
    },
    {
      caption: "src/features/drills/drills.ts — the same question, one file over",
      kind: "diff",
      language: "ts",
      verbatim: true,
      href: DRILLS,
      lines: [
        "   const pool = DRILLS.filter((d) => d.locale === locale)",
        "-  const day = Math.floor(now / 86_400_000)",
        "-  return pool[day % pool.length]",
        "+  return pool[localDayIndex(now) % pool.length]",
        "+}",
        "+",
        "+function localDayIndex(now: number): number {",
        "+  const d = new Date(now)",
        "+  return Math.floor(",
        "+    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000,",
        "+  )",
        " }",
      ],
    },
  ],

  test: {
    intro: [
      "The interesting problem with this test is that it can pass for free. CI runs in UTC, and UTC has no daylight-saving transitions, so a DST regression test written the obvious way is green on a machine where the bug cannot happen.",
      "So the test pins the zone with `vi.stubEnv(\"TZ\", …)` and runs the same assertions in both America/Los_Angeles and America/New_York. Node re-reads `TZ` on each `Date` operation, which is enough.",
      "There are two boundary cases, not one: a 23-hour day must not be skipped, and a 25-hour day must not be counted twice. Both were confirmed to fail against the old implementation before the fix went in.",
    ],
    excerpt: {
      caption: "src/features/drills/streak.test.ts",
      kind: "code",
      language: "ts",
      verbatim: true,
      href: STREAK_TEST,
      lines: [
        "// CI runs in UTC, which has no DST — pinning the zone is what makes",
        "// these assertions meaningful rather than trivially green.",
        "const useTimeZone = (tz: string) => vi.stubEnv(\"TZ\", tz);",
        "",
        "it.each([\"America/Los_Angeles\", \"America/New_York\"])(",
        "  \"survives the spring-forward boundary just after midnight in %s\",",
        "  (tz) => {",
        "    useTimeZone(tz);",
        "    const records = cleared([",
        "      \"2026-03-06\",",
        "      \"2026-03-07\",",
        "      \"2026-03-08\", // 23-hour day",
        "      \"2026-03-09\",",
        "      \"2026-03-10\",",
        "    ]);",
        "    expect(",
        "      computeStreak(records, new Date(\"2026-03-10T00:30:00\").getTime()),",
        "    ).toBe(5);",
        "  },",
        ");",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "The walk and the keys disagreed",
      detail:
        "`computeStreak` stepped in milliseconds while `localDateKey` read local calendar fields. Reproduced in two North American zones: 2026-03-08 disappeared from the walk when the streak was checked between midnight and 1am.",
      source: { kind: "commit", label: "82d995c", href: STREAK_FIX },
    },
    {
      phase: "attempted",
      title: "Step the calendar instead",
      detail:
        "`cursor.setDate(cursor.getDate() - 1)` is DST-correct by construction. Shipped with streak.test.ts, including the fall-back case so the 25-hour day is not double-counted.",
      source: {
        kind: "commit",
        label: "82d995c — count the streak by calendar date",
        href: STREAK_FIX,
      },
    },
    {
      phase: "fixed",
      title: "Make the drill agree with the badge",
      detail:
        "`todaysDrill` still indexed UTC days, so in UTC-7 the drill swapped at 5pm local. Replaced with a local day index so the rotation, the cleared badge and the streak key all roll over at the same midnight.",
      source: {
        kind: "commit",
        label: "ff02395 — plus four smaller defects",
        href: DRILL_FIX,
      },
    },
    {
      phase: "regression-test",
      title: "Pin the zone, or the test means nothing",
      detail:
        "streak.test.ts stubs TZ per case and covers both transitions in two zones; dailyDrill.test.ts covers the rotation boundary. Both were confirmed failing against the old code first.",
      source: {
        kind: "file",
        label: "src/features/drills/streak.test.ts",
        href: STREAK_TEST,
      },
    },
  ],

  sources: [
    {
      kind: "commit",
      label: "82d995c — count the streak by calendar date, not by 86_400_000ms",
      href: STREAK_FIX,
    },
    {
      kind: "commit",
      label: "ff02395 — todaysDrill indexed UTC days",
      href: DRILL_FIX,
      note: "The relevant paragraph is the fourth bullet.",
    },
    { kind: "file", label: "src/features/drills/useGym.ts", href: USE_GYM },
    { kind: "file", label: "src/features/drills/drills.ts", href: DRILLS },
    {
      kind: "file",
      label: "src/features/drills/streak.test.ts",
      href: STREAK_TEST,
    },
  ],

  evidence:
    "Two ToneDown commits on main, 17 minutes apart: 82d995c fixes the walk, ff02395 fixes the rotation.",
  simulationNote:
    "The clock here uses a small hard-coded model of America/Los_Angeles for 2026 (UTC-8, UTC-7 between 8 March and 1 November) so it behaves the same in every visitor's time zone. The three walk implementations are ToneDown's, transcribed.",
};
