"use client";

import { useMemo, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import {
  ZONE_LABEL,
  fromLocal,
  isDaylight,
  localClock,
  localDateKey,
  rotationHour,
  rotationStrip,
  walkStreak,
} from "@/lib/sims/local-day";
import { Readout } from "../readout";
import sim from "../sim.module.css";
import s from "./day.module.css";

type Scenario = "spring" | "autumn";

interface ScenarioConfig {
  label: string;
  cleared: string[];
  day: [number, number, number];
  /** The local hour where the fixed-millisecond walk goes wrong. */
  hour: number;
  transition: string;
  note: string;
}

const SCENARIOS: Record<Scenario, ScenarioConfig> = {
  spring: {
    label: "Spring forward",
    cleared: [
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ],
    day: [2026, 2, 10],
    hour: 0,
    transition: "2026-03-08",
    note: "8 March is 23 hours long, so a 24-hour step from just after midnight overshoots it.",
  },
  autumn: {
    label: "Fall back",
    cleared: ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"],
    day: [2026, 10, 1],
    hour: 23,
    transition: "2026-11-01",
    note: "1 November is 25 hours long, so a 24-hour step late in the evening lands on it again.",
  },
};

const DRILLS = ["Softening a hard no", "Asking for a deadline"];

export function DaySim({ state }: { state: StateKey }) {
  const walkVersion = state === "broken" ? "milliseconds" : "calendar";
  const drillVersion = state === "fixed" ? "local" : "utc";

  const [scenario, setScenario] = useState<Scenario>("spring");
  const [hour, setHour] = useState(SCENARIOS.spring.hour);
  const minute = 30;

  const config = SCENARIOS[scenario];
  const [y, m, d] = config.day;

  const now = useMemo(
    () => fromLocal({ year: y, month: m, day: d, hour, minute }),
    [y, m, d, hour, minute],
  );

  const walk = useMemo(
    () => walkStreak(walkVersion, now, config.cleared),
    [walkVersion, now, config.cleared],
  );

  const dayStart = useMemo(
    () => fromLocal({ year: y, month: m, day: d, hour: 0, minute: 0 }),
    [y, m, d],
  );

  const hours = useMemo(
    () => rotationStrip(drillVersion, dayStart),
    [drillVersion, dayStart],
  );

  const flipHour = rotationHour(drillVersion, dayStart);
  const expected = config.cleared.length;

  return (
    <div className={sim.sim}>
      <div className={sim.controls}>
        {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
          <button
            key={key}
            type="button"
            className={cx(sim.btn, scenario === key && sim.btnPrimary)}
            aria-pressed={scenario === key}
            onClick={() => {
              setScenario(key);
              setHour(SCENARIOS[key].hour);
            }}
          >
            {SCENARIOS[key].label}
          </button>
        ))}
        <button
          type="button"
          className={sim.btn}
          onClick={() => setHour(config.hour)}
        >
          Jump to {String(config.hour).padStart(2, "0")}:30
        </button>
      </div>

      <div>
        <label className="label" htmlFor="day-sim-hour">
          Local time — {localDateKey(now)} {localClock(now)} ({ZONE_LABEL},
          {isDaylight(now) ? " UTC-7" : " UTC-8"})
        </label>
        <input
          id="day-sim-hour"
          className={s.slider}
          type="range"
          min={0}
          max={23}
          step={1}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
        />
      </div>

      <div className={sim.readouts}>
        <Readout
          name="streak"
          value={`${walk.streak} of ${expected}`}
          tone={walk.streak === expected ? "fixed" : "broken"}
        />
        <Readout name="local time" value={`${String(hour).padStart(2, "0")}:30`} />
        <Readout
          name="walk"
          value={walkVersion === "milliseconds" ? "− 86,400,000ms" : "setDate(−1)"}
        />
        <Readout
          name="drill rotates"
          value={flipHour === 24 ? "00:00" : `${String(flipHour).padStart(2, "0")}:00`}
          tone={flipHour === 24 ? "fixed" : "first"}
        />
      </div>

      <div className={s.grid}>
        <div className={sim.panel}>
          <p className={sim.panelHead}>
            <span>Walking the streak back</span>
            <span>{walkVersion === "milliseconds" ? "fixed ms" : "calendar"}</span>
          </p>

          <ul className={s.steps}>
            {walk.steps.map((step) => (
              <li
                key={step.index}
                className={cx(
                  s.step,
                  step.counted && s.stepCounted,
                  !step.cleared && s.stepMiss,
                )}
              >
                <span className={s.stepIndex}>−{step.index}d</span>
                <span className={s.stepKey}>{step.key}</span>
                <span className={s.stepTime}>{localClock(step.instant)}</span>
                <span>{step.cleared ? "✓" : "·"}</span>
              </li>
            ))}
          </ul>

          <p className={sim.panelHead}>
            <span>Cleared records</span>
          </p>
          <div className={s.records}>
            {config.cleared.map((date) => {
              const transition = date === config.transition;
              const repeated = walk.duplicates.includes(date);
              return (
                <span
                  key={date}
                  className={cx(
                    s.rec,
                    transition && s.recDst,
                    walk.skipped.includes(date) && s.recSkipped,
                  )}
                >
                  {date}
                  {transition ? " ⚠" : ""}
                  {repeated ? " ×2" : ""}
                </span>
              );
            })}
          </div>

          <p className={sim.hint} data-testid="walk-verdict">
            {walk.skipped.length > 0
              ? `The walk never looked at ${walk.skipped.join(", ")}. ${config.note}`
              : walk.duplicates.length > 0
                ? `The walk landed on ${walk.duplicates.join(", ")} twice and counted it twice. ${config.note}`
                : `Every cleared date was visited exactly once. ${config.note}`}
          </p>
        </div>

        <div className={sim.panel}>
          <p className={sim.panelHead}>
            <span>Which drill is “today’s”?</span>
            <span>{drillVersion === "utc" ? "UTC days" : "local days"}</span>
          </p>

          <div className={s.hours} aria-hidden="true">
            {hours.map((which, h) => (
              <span
                key={h}
                className={cx(
                  s.hour,
                  which === 0 ? s.hourA : s.hourB,
                  h === hour && s.hourNow,
                )}
              />
            ))}
          </div>
          <p className={s.hourScale}>
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </p>

          <p className={s.legend}>
            <span>
              <span className={cx(s.swatch, s.hourA)} />
              {DRILLS[0]}
            </span>
            <span>
              <span className={cx(s.swatch, s.hourB)} />
              {DRILLS[1]}
            </span>
          </p>

          <p className={sim.hint} data-testid="drill-verdict">
            {flipHour === 24
              ? "One drill for the whole local day. It changes at local midnight, which is when the cleared badge and the streak key roll over too."
              : `The drill changes at ${String(flipHour).padStart(2, "0")}:00 local — mid-afternoon. Anyone who cleared it in the morning is offered a second one, and the badge resets.`}
          </p>
        </div>
      </div>
    </div>
  );
}
