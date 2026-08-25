import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  drillIndex,
  fromLocal,
  isDaylight,
  localDateKey,
  rotationHour,
  walkStreak,
} from "@/lib/sims/local-day";

const SPRING = [
  "2026-03-06",
  "2026-03-07",
  "2026-03-08", // 23-hour day
  "2026-03-09",
  "2026-03-10",
];

const AUTUMN = ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];

const at = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) => fromLocal({ year, month, day, hour, minute });

describe("the fixed America/Los_Angeles model", () => {
  it("knows which side of the transitions it is on", () => {
    expect(isDaylight(at(2026, 1, 1, 12))).toBe(false);
    expect(isDaylight(at(2026, 5, 1, 12))).toBe(true);
    expect(isDaylight(at(2026, 11, 1, 12))).toBe(false);
  });

  it("round-trips a local wall clock through an instant", () => {
    expect(localDateKey(at(2026, 2, 10, 0, 30))).toBe("2026-03-10");
    expect(localDateKey(at(2026, 2, 8, 23, 59))).toBe("2026-03-08");
    expect(localDateKey(at(2026, 10, 1, 0, 30))).toBe("2026-11-01");
  });

  it("steps calendar days across both transitions", () => {
    expect(localDateKey(addLocalDays(at(2026, 2, 10, 0, 30), -2))).toBe(
      "2026-03-08",
    );
    expect(localDateKey(addLocalDays(at(2026, 10, 3, 0, 30), -2))).toBe(
      "2026-11-01",
    );
    expect(localDateKey(addLocalDays(at(2026, 10, 1, 23, 30), -1))).toBe(
      "2026-10-31",
    );
  });
});

describe("computeStreak, in milliseconds", () => {
  it("skips the 23-hour day when run just after midnight", () => {
    const result = walkStreak("milliseconds", at(2026, 2, 10, 0, 30), SPRING);
    expect(result.skipped).toContain("2026-03-08");
    expect(result.streak).toBeLessThan(SPRING.length);
  });

  it("is fine later the same morning, which is why it hid", () => {
    const result = walkStreak("milliseconds", at(2026, 2, 10, 9, 0), SPRING);
    expect(result.streak).toBe(SPRING.length);
  });

  it("visits the 25-hour day twice, late on the day itself", () => {
    const result = walkStreak("milliseconds", at(2026, 10, 1, 23, 30), AUTUMN);
    expect(result.duplicates).toContain("2026-11-01");
    expect(result.streak).toBeGreaterThan(AUTUMN.length);
  });
});

describe("computeStreak, by calendar date", () => {
  it("survives the spring-forward boundary just after midnight", () => {
    const result = walkStreak("calendar", at(2026, 2, 10, 0, 30), SPRING);
    expect(result.skipped).toEqual([]);
    expect(result.streak).toBe(SPRING.length);
  });

  it("does not double-count the fall-back day", () => {
    const result = walkStreak("calendar", at(2026, 10, 1, 23, 30), AUTUMN);
    expect(result.duplicates).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.streak).toBe(AUTUMN.length);
  });

  it("still stops at the first real gap", () => {
    const withHole = ["2026-06-08", "2026-06-10", "2026-06-11"];
    const result = walkStreak("calendar", at(2026, 5, 11, 9, 0), withHole);
    expect(result.streak).toBe(2);
  });

  it("does not let an uncleared today break yesterday's streak", () => {
    const result = walkStreak("calendar", at(2026, 5, 12, 9, 0), [
      "2026-06-10",
      "2026-06-11",
    ]);
    expect(result.streak).toBe(2);
  });
});

describe("todaysDrill", () => {
  it("rotates mid-afternoon while it counts UTC days", () => {
    const dayStart = at(2026, 5, 10, 0);
    expect(rotationHour("utc", dayStart)).toBe(17); // UTC-7 in June
  });

  it("rotates at local midnight once it counts local days", () => {
    for (const [m, d] of [
      [1, 15],
      [5, 10],
      [2, 8],
      [10, 1],
    ] as const) {
      expect(rotationHour("local", at(2026, m, d, 0))).toBe(24);
    }
  });

  it("gives the same index all day, locally", () => {
    const dayStart = at(2026, 2, 8, 0);
    const indices = new Set(
      Array.from({ length: 23 }, (_, h) =>
        drillIndex("local", dayStart + h * 3_600_000),
      ),
    );
    expect(indices.size).toBe(1);
  });
});
