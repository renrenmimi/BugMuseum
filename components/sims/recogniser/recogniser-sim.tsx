"use client";

import { useEffect, useMemo, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import type { RecogniserEvent } from "@/lib/sims/restart-loop";
import { TICK_MS, countOf, runRecogniser } from "@/lib/sims/restart-loop";
import { EventLog } from "../event-log";
import { Readout } from "../readout";
import type { LogEntry, LogTone } from "../use-event-log";
import sim from "../sim.module.css";
import s from "./recogniser.module.css";

const MAX_TICKS = 16;

const TONE: Record<RecogniserEvent["kind"], LogTone> = {
  user: "neutral",
  effect: "neutral",
  start: "fixed",
  stop: "broken",
  end: "broken",
  result: "fixed",
  partial: "broken",
};

/** Was the engine running at the end of this tick? */
function runningAt(events: readonly RecogniserEvent[], tick: number): boolean {
  const t = tick * TICK_MS;
  let running = false;
  for (const e of events) {
    if (e.t > t) break;
    if (e.kind === "start") running = true;
    if (e.kind === "end") running = false;
  }
  return running;
}

function stoppedDuring(events: readonly RecogniserEvent[], tick: number): boolean {
  const t = tick * TICK_MS;
  return events.some((e) => e.t === t && (e.kind === "stop" || e.kind === "end"));
}

export function RecogniserSim({ state }: { state: StateKey }) {
  const version = state === "fixed" ? "fixed" : "broken";
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [switchAt, setSwitchAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    setTick(0);
    setPlaying(false);
    setSwitchAt(undefined);
  }, [version]);

  const run = useMemo(
    () => runRecogniser(version, { ticks: MAX_TICKS, switchAt }),
    [version, switchAt],
  );

  const upTo = tick * TICK_MS;
  const shown = run.events.filter((e) => e.t <= upTo);

  useEffect(() => {
    if (!playing) return;
    if (tick >= MAX_TICKS) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setTick((t) => t + 1), 260);
    return () => window.clearTimeout(id);
  }, [playing, tick]);

  const entries: LogEntry[] = shown.map((e, i) => ({
    id: i,
    stamp: `${e.t}ms`,
    text: `${e.kind}: ${e.text}`,
    tone: TONE[e.kind],
  }));

  const words = shown.filter((e) => e.kind === "result").map((e) => e.text);
  const fragments = shown.filter((e) => e.kind === "partial");
  const starts = countOf(shown, "start");
  const ends = countOf(shown, "end");

  return (
    <div className={sim.sim}>
      <p
        className={cx(s.deps, version === "fixed" ? s.depsFixed : s.depsBroken)}
        data-testid="deps"
      >
        {version === "fixed"
          ? "useEffect(() => { … }, [language])  // + a ref for the applied one"
          : "useEffect(() => { … }, [isRecognizing, language])  // it sets this"}
      </p>

      <div className={sim.controls}>
        <button
          type="button"
          className={cx(sim.btn, !playing && sim.btnPrimary)}
          onClick={() => {
            if (tick >= MAX_TICKS) setTick(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : tick === 0 ? "Start listening" : "Play"}
        </button>
        <button
          type="button"
          className={sim.btn}
          onClick={() => setTick((t) => Math.min(MAX_TICKS, t + 1))}
          disabled={tick >= MAX_TICKS}
        >
          Step one tick
        </button>
        <button
          type="button"
          className={sim.btn}
          onClick={() => setSwitchAt(switchAt === undefined ? 6 : undefined)}
          aria-pressed={switchAt !== undefined}
        >
          {switchAt === undefined ? "Switch language at tick 6" : "No language switch"}
        </button>
        <button
          type="button"
          className={sim.btn}
          onClick={() => {
            setTick(0);
            setPlaying(false);
          }}
        >
          Reset
        </button>
      </div>

      <div className={sim.readouts}>
        <Readout name="clock" value={`${upTo}ms`} />
        <Readout
          name="start()"
          value={starts}
          tone={starts > 2 ? "broken" : "fixed"}
        />
        <Readout name="onend" value={ends} tone={ends > 0 ? "broken" : "fixed"} />
        <Readout
          name="words kept"
          value={words.length}
          tone={words.length === 0 && tick > 4 ? "broken" : "neutral"}
        />
      </div>

      <div className={s.strip} aria-hidden="true">
        {Array.from({ length: MAX_TICKS + 1 }, (_, i) => {
          const done = i <= tick;
          const running = done && runningAt(run.events, i);
          const stopped = done && stoppedDuring(run.events, i);
          return (
            <span
              key={i}
              className={cx(
                s.tick,
                !done && s.tickIdle,
                running && s.tickRunning,
                stopped && s.tickStopped,
              )}
            />
          );
        })}
      </div>

      <div>
        <p className="label" style={{ marginBottom: "var(--s-2)" }}>
          Transcript
        </p>
        <div className={s.transcript} data-testid="transcript">
          {words.length === 0 ? (
            <span className={s.transcriptEmpty}>
              {fragments.length > 0
                ? `${fragments.length} fragments heard and discarded`
                : "nothing yet"}
            </span>
          ) : (
            words.join(" ")
          )}
        </div>
      </div>

      <EventLog
        entries={entries}
        label="Recogniser event log"
        empty="Press Start listening."
      />
    </div>
  );
}
