"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import type {
  AdvanceInfo,
  Clock,
  RunnerState,
  SubmitOutcome,
} from "@/lib/sims/double-submit";
import { BLANKS, createBlankRunner } from "@/lib/sims/double-submit";
import { EventLog } from "../event-log";
import { Readout } from "../readout";
import type { LogTone } from "../use-event-log";
import { useEventLog } from "../use-event-log";
import sim from "../sim.module.css";
import s from "./blanks.module.css";

const ADVANCE_MS = 700;

const CODE_LINES: (string | number)[][] = [
  ["function total(prices) {"],
  ["  ", 0, " sum = 0;"],
  ["  for (const price ", 1, " prices) {"],
  ["    sum += price;"],
  ["  }"],
  ["  ", 2, " sum;"],
  ["}"],
];

/** setTimeout, with a way to drop everything when the case goes away. */
function createLiveClock(): Clock & { dispose: () => void } {
  const live = new Map<number, number>();
  let nextId = 1;

  return {
    schedule(fn, ms) {
      const id = nextId;
      nextId += 1;
      const handle = window.setTimeout(() => {
        live.delete(id);
        fn();
      }, ms);
      live.set(id, handle);
      return id;
    },
    cancel(id) {
      const handle = live.get(id);
      if (handle !== undefined) window.clearTimeout(handle);
      live.delete(id);
    },
    dispose() {
      for (const handle of live.values()) window.clearTimeout(handle);
      live.clear();
    },
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** One line in the log for every advance that fires, so the skips are written down. */
function describeAdvance(info: AdvanceInfo): [string, LogTone] {
  if (info.left === null) {
    return ["an advance fired after the last blank — there was nothing left to skip", "broken"];
  }
  const blank = info.left + 1;
  if (info.stale) {
    return [
      `a timer queued before the restart fired — moved past blank ${blank}${
        info.skipped ? " before it could be answered" : ""
      }`,
      "broken",
    ];
  }
  if (info.skipped) return [`moved past blank ${blank} — it was never on screen`, "broken"];
  return [`moved on from blank ${blank}`, "neutral"];
}

const INITIAL: RunnerState = {
  solved: 0,
  value: "",
  feedback: { kind: "idle" },
  seen: [0],
  skipped: [],
  advancesScheduled: 0,
  advancesRun: 0,
  pending: 0,
};

export function BlanksSim({ state }: { state: StateKey }) {
  const version = state === "fixed" ? "fixed" : "broken";
  const inputId = useId();
  const [snapshot, setSnapshot] = useState<RunnerState>(INITIAL);
  const { entries, push, clear } = useEventLog(40);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const tone = version === "fixed" ? "fixed" : "broken";

  /* One runner per version, on a clock of its own. Building them has no side
     effects; the effect below wires them up and tears them down. */
  const { runner, clock } = useMemo(() => {
    const liveClock = createLiveClock();
    return {
      clock: liveClock,
      runner: createBlankRunner(version, liveClock, ADVANCE_MS),
    };
  }, [version]);

  useEffect(() => {
    runner.onChange(setSnapshot);
    runner.onAdvance((info) => {
      const [text, lineTone] = describeAdvance(info);
      push("advance", text, lineTone);
    });
    setSnapshot(runner.state());
    clear();
    return () => {
      runner.unmount();
      /* The case's own clock leaves with the component, whichever handler is
         running. Restart is where a leaked timer is shown, while it can still
         be seen; after unmount there is nothing left to show it to. */
      clock.dispose();
    };
  }, [runner, clock, push, clear]);

  const current = BLANKS[snapshot.solved];
  const done = snapshot.solved >= BLANKS.length;
  const skippedCount = snapshot.skipped.length;

  const report = useCallback(
    (label: string, outcome: SubmitOutcome, revealed = false) => {
      const after = runner.state();
      switch (outcome) {
        case "scheduled":
          push(
            label,
            `${revealed ? "revealed" : "correct"} — setTimeout(advance, ${ADVANCE_MS}) queued (${after.advancesScheduled} total)`,
            tone,
          );
          break;
        case "blocked":
          push(
            label,
            `${revealed ? "reveal ignored" : "ignored"}: an advance is already pending`,
            "fixed",
          );
          break;
        case "wrong":
          push(label, "wrong answer — nothing queued");
          break;
        case "empty":
          push(label, "nothing typed — nothing to submit");
          break;
        case "done":
          push(label, "nothing left to answer");
          break;
      }
    },
    [runner, push, tone],
  );

  const submit = useCallback(
    (label: string) => report(label, runner.submit()),
    [runner, report],
  );

  /* Finishing disables the form. If the focus was in it, hand it to Restart
     rather than letting it fall back to the top of the document. This runs
     before the browser notices the focused control has been disabled. */
  useLayoutEffect(() => {
    if (!done) return;
    const active = document.activeElement;
    if (active && active !== restartRef.current && formRef.current?.contains(active)) {
      restartRef.current?.focus();
    }
  }, [done]);

  const answerFor = (index: number) => BLANKS[index]?.display ?? "";

  const blankClass = (index: number) => {
    if (snapshot.skipped.includes(index)) return s.blankSkipped;
    if (snapshot.solved > index) return s.blankDone;
    if (snapshot.solved === index) return s.blankActive;
    return undefined;
  };

  const blankText = (index: number) => {
    if (snapshot.skipped.includes(index)) return "skipped";
    if (snapshot.solved > index) return answerFor(index);
    return "____";
  };

  return (
    <div className={sim.sim}>
      <div className={s.codeCard}>
        {CODE_LINES.map((parts, i) => (
          <div key={i}>
            {parts.map((part, j) =>
              typeof part === "number" ? (
                <span key={j} className={cx(s.blank, blankClass(part))}>
                  {blankText(part)}
                </span>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
          </div>
        ))}
      </div>

      <p className={s.prompt} data-testid="blank-prompt">
        {done
          ? skippedCount > 0
            ? `Finished — ${skippedCount} of ${BLANKS.length} blanks went by without being answered.`
            : "All three blanks are filled."
          : `Blank ${snapshot.solved + 1} of ${BLANKS.length} — ${current?.prompt ?? ""}`}
      </p>

      <div className={s.form} ref={formRef}>
        <label className="visually-hidden" htmlFor={inputId}>
          Your answer
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className={s.input}
          type="text"
          value={snapshot.value}
          placeholder="type your answer"
          disabled={done}
          onChange={(e) => runner.type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            submit("Enter");
          }}
        />
        <button
          type="button"
          className={sim.btn}
          disabled={done}
          onClick={() => {
            runner.type(current?.display ?? "");
            inputRef.current?.focus();
          }}
        >
          Fill the answer
        </button>
        <button
          type="button"
          className={sim.btn}
          disabled={done}
          onClick={() => report("Reveal", runner.reveal(), true)}
        >
          Reveal
        </button>
        <button
          type="button"
          className={cx(sim.btn, sim.btnPrimary)}
          disabled={done}
          onClick={() => submit("Enter")}
        >
          Submit
        </button>
        <button
          type="button"
          className={sim.btn}
          disabled={done}
          data-testid="double-enter"
          onClick={() => {
            submit("Enter ①");
            submit("Enter ②");
          }}
        >
          Press Enter twice
        </button>
        <button
          type="button"
          className={sim.btn}
          ref={restartRef}
          onClick={() => {
            const { cancelled, stillPending } = runner.restart();
            clear();
            if (stillPending > 0) {
              push(
                "restart",
                `${stillPending} queued ${plural(stillPending, "advance is", "advances are")} still running — the handler never kept ${plural(stillPending, "its id", "their ids")}, so nothing can cancel ${plural(stillPending, "it", "them")}`,
                "broken",
              );
            } else if (cancelled > 0) {
              push("restart", "pending timer cancelled, back to blank 1", "fixed");
            } else {
              push("restart", "back to blank 1");
            }
          }}
        >
          Restart
        </button>
      </div>

      <p
        className={cx(
          s.feedback,
          snapshot.feedback.kind === "right" && s.right,
          snapshot.feedback.kind === "wrong" && s.wrong,
          snapshot.feedback.kind === "hint" && s.hint,
        )}
        role="status"
      >
        {snapshot.feedback.kind === "idle"
          ? "Fill the answer, then press Enter twice as fast as you can."
          : snapshot.feedback.msg}
      </p>

      <div>
        <p className="label" style={{ marginBottom: "var(--s-2)" }}>
          Timer queue
        </p>
        <div className={s.queue} data-testid="timer-queue">
          {Array.from({ length: Math.max(2, snapshot.pending) }, (_, i) => (
            <span
              key={i}
              className={cx(
                s.slot,
                i < snapshot.pending && s.slotFull,
                i < snapshot.pending && i > 0 && s.slotExtra,
              )}
            >
              {i < snapshot.pending
                ? `${i > 0 ? "extra " : ""}advance +${ADVANCE_MS}ms`
                : "empty"}
            </span>
          ))}
        </div>
      </div>

      <div className={sim.readouts}>
        <Readout
          name="timers queued"
          value={snapshot.advancesScheduled}
          tone={snapshot.pending > 1 || skippedCount > 0 ? "broken" : "neutral"}
        />
        <Readout name="blank shown" value={`${Math.min(snapshot.solved + 1, 3)}/3`} />
        <Readout
          name="blanks skipped"
          value={skippedCount}
          tone={skippedCount > 0 ? "broken" : "fixed"}
        />
      </div>

      <EventLog entries={entries} label="Fill-in-the-blank event log" />
    </div>
  );
}
