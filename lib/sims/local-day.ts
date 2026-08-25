/* ============================================================
   A hard-coded America/Los_Angeles for 2026, so the exhibit and
   its tests read the same in every visitor's time zone and on any
   CI runner — including one running in UTC, which has no
   transitions and would make these assertions trivially green.

   Daylight time runs from 02:00 on 8 March (a 23-hour day) to
   02:00 on 1 November (a 25-hour day). Both are Sundays.
   ============================================================ */

export const ZONE_LABEL = "America/Los_Angeles";
const STANDARD_OFFSET_MIN = -480; // UTC-8
const DAYLIGHT_OFFSET_MIN = -420; // UTC-7

/** 2026-03-08T02:00 PST === 10:00Z */
export const DST_START_UTC = Date.UTC(2026, 2, 8, 10, 0);
/** 2026-11-01T02:00 PDT === 09:00Z */
export const DST_END_UTC = Date.UTC(2026, 10, 1, 9, 0);

export const DAY_MS = 86_400_000;

export function offsetMinutes(utcMs: number): number {
  return utcMs >= DST_START_UTC && utcMs < DST_END_UTC
    ? DAYLIGHT_OFFSET_MIN
    : STANDARD_OFFSET_MIN;
}

export interface LocalParts {
  year: number;
  month: number; // 0-based, like Date
  day: number;
  hour: number;
  minute: number;
}

export function toLocal(utcMs: number): LocalParts {
  const shifted = new Date(utcMs + offsetMinutes(utcMs) * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/**
 * Local wall-clock time back to an instant. The second pass matters: the
 * offset depends on the instant we are trying to compute, so the first guess
 * can land on the wrong side of a transition.
 */
export function fromLocal(p: LocalParts): number {
  const naive = Date.UTC(p.year, p.month, p.day, p.hour, p.minute);
  const first = naive - STANDARD_OFFSET_MIN * 60_000;
  const offset = offsetMinutes(first);
  const second = naive - offset * 60_000;
  return offsetMinutes(second) === offset
    ? second
    : naive - offsetMinutes(second) * 60_000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A date key read from local calendar fields, never from UTC. */
export function localDateKey(utcMs: number): string {
  const p = toLocal(utcMs);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

export function localClock(utcMs: number): string {
  const p = toLocal(utcMs);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function isDaylight(utcMs: number): boolean {
  return offsetMinutes(utcMs) === DAYLIGHT_OFFSET_MIN;
}

/** What `cursor.setDate(cursor.getDate() - 1)` does, in this fixed zone. */
export function addLocalDays(utcMs: number, delta: number): number {
  const p = toLocal(utcMs);
  return fromLocal({ ...p, day: p.day + delta });
}

export type WalkVersion = "milliseconds" | "calendar";

export interface WalkStep {
  /** How many steps back from today. */
  index: number;
  instant: number;
  key: string;
  cleared: boolean;
  counted: boolean;
}

export interface WalkResult {
  streak: number;
  steps: WalkStep[];
  /** Dates in the record set that the walk never looked at. */
  skipped: string[];
  /** Dates the walk landed on more than once — the 25-hour day. */
  duplicates: string[];
}

/**
 * The streak walk, in both versions. The loop shape — including "an uncleared
 * today does not break yesterday's streak" — is part of what is being
 * reproduced, so it is kept rather than simplified.
 */
export function walkStreak(
  version: WalkVersion,
  now: number,
  clearedDates: readonly string[],
  maxSteps = 8,
): WalkResult {
  const cleared = new Set(clearedDates);
  const steps: WalkStep[] = [];
  const visited = new Set<string>();
  let streak = 0;
  let cursor = now;

  for (let day = 0; day < maxSteps; day += 1) {
    const instant = version === "milliseconds" ? now - day * DAY_MS : cursor;
    const key = localDateKey(instant);
    visited.add(key);
    const hit = cleared.has(key);
    let counted = false;

    if (hit) {
      streak += 1;
      counted = true;
    }
    steps.push({ index: day, instant, key, cleared: hit, counted });

    if (!hit && day > 0) break;
    if (version === "calendar") cursor = addLocalDays(cursor, -1);
  }

  const skipped = clearedDates.filter((d) => !visited.has(d));
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const step of steps) {
    if (seen.has(step.key) && !duplicates.includes(step.key)) {
      duplicates.push(step.key);
    }
    seen.add(step.key);
  }
  return { streak, steps, skipped, duplicates };
}

export type DrillVersion = "utc" | "local";

/** Which drill is "today's", counted two different ways. */
export function drillIndex(version: DrillVersion, utcMs: number): number {
  if (version === "utc") return Math.floor(utcMs / DAY_MS);
  const p = toLocal(utcMs);
  return Math.floor(Date.UTC(p.year, p.month, p.day) / DAY_MS);
}

/**
 * The local hour at which the drill rotates, sampled rather than derived —
 * the point is that one of these answers is not midnight. Sampling local
 * wall-clock hours rather than elapsed hours matters on the two days a
 * year when those are not the same thing.
 */
export function rotationHour(version: DrillVersion, dayStartUtc: number): number {
  const p = toLocal(dayStartUtc);
  const base = drillIndex(version, dayStartUtc);
  for (let hour = 1; hour <= 23; hour += 1) {
    if (drillIndex(version, fromLocal({ ...p, hour, minute: 0 })) !== base) {
      return hour;
    }
  }
  return 24;
}

/** Which drill each local hour of a day would serve. 0 or 1. */
export function rotationStrip(
  version: DrillVersion,
  dayStartUtc: number,
): number[] {
  const p = toLocal(dayStartUtc);
  const base = drillIndex(version, dayStartUtc);
  return Array.from({ length: 24 }, (_, hour) =>
    drillIndex(version, fromLocal({ ...p, hour, minute: 0 })) === base ? 0 : 1,
  );
}
