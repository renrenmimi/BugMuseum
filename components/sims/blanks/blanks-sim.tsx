"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import type { Clock, RunnerState } from "@/lib/sims/double-submit";
import { BLANKS, createBlankRunner } from "@/lib/sims/double-submit";
import { EventLog } from "../event-log";
import { Readout } from "../readout";
import { useEventLog } from "../use-event-log";
import sim from "../sim.module.css";
import s from "./blanks.module.css";

const ADVANCE_MS = 700;

const CODE_LINES: (string | number)[][] = [
  ["const ", 0, " = [{ role: 'user', content: task }];"],
  ["while (true) {"],
  ["  const res = await client.messages.create({ ", 0, " });"],
  ["  if (res.stop_reason !== '", 1, "') return res;"],
  ["  ", 0, ".push({ role: 'assistant', content: res.content });"],
  ["  ", 0, ".push({ role: '", 2, "', content: toolResults });"],
  ["}"],
];

function createLiveClock(onChange: (pending: number) => void): Clock & {
  pending: () => number;
  dispose: () => void;
} {
  const live = new Map<number, number>();
  let nextId = 1;

  const notify = () => onChange(live.size);

  return {
    schedule(fn, ms) {
      const id = nextId;
      nextId += 1;
      const handle = window.setTimeout(() => {
        live.delete(id);
        notify();
        fn();
      }, ms);
      live.set(id, handle);
      notify();
      return id;
    },
    cancel(id) {
      const handle = live.get(id);
      if (handle !== undefined) window.clearTimeout(handle);
      live.delete(id);
      notify();
    },
    pending: () => live.size,
    dispose() {
      for (const handle of live.values()) window.clearTimeout(handle);
      live.clear();
    },
  };
}

export function BlanksSim({ state }: { state: StateKey }) {
  const version = state === "fixed" ? "fixed" : "broken";
  const [pending, setPending] = useState(0);
  const [snapshot, setSnapshot] = useState<RunnerState>({
    solved: 0,
    value: "",
    feedback: { kind: "idle" },
    seen: [0],
    advancesScheduled: 0,
    advancesRun: 0,
  });
  const { entries, push, clear } = useEventLog(40);
  const inputRef = useRef<HTMLInputElement>(null);
  const clockRef = useRef<ReturnType<typeof createLiveClock> | null>(null);

  const tone = version === "fixed" ? "fixed" : "broken";

  const runner = useMemo(() => {
    clockRef.current?.dispose();
    const clock = createLiveClock(setPending);
    clockRef.current = clock;
    return createBlankRunner(version, clock, ADVANCE_MS);
  }, [version]);

  useEffect(() => {
    runner.onChange(setSnapshot);
    setSnapshot(runner.state());
    clear();
    setPending(0);
    return () => {
      runner.unmount();
    };
  }, [runner, clear]);

  const current = BLANKS[snapshot.solved];
  const done = snapshot.solved >= BLANKS.length;

  const submit = useCallback(
    (label: string) => {
      const before = runner.state();
      runner.submit();
      const after = runner.state();
      if (after.advancesScheduled > before.advancesScheduled) {
        push(
          label,
          `correct — setTimeout(advance, ${ADVANCE_MS}) queued (${after.advancesScheduled} total)`,
          after.advancesScheduled > 1 && version === "broken" ? "broken" : tone,
        );
      } else if (after.feedback.kind === "wrong") {
        push(label, "wrong answer — nothing queued");
      } else {
        push(label, "ignored: an advance is already pending", "fixed");
      }
    },
    [runner, push, tone, version],
  );

  const answerFor = (index: number) => BLANKS[index]?.display ?? "";

  const blankClass = (index: number) => {
    if (snapshot.solved > index) {
      return snapshot.seen.includes(index) ? s.blankDone : s.blankSkipped;
    }
    if (snapshot.solved === index) return s.blankActive;
    return undefined;
  };

  const blankText = (index: number) => {
    if (snapshot.solved > index) {
      return snapshot.seen.includes(index) ? answerFor(index) : "skipped";
    }
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
          ? "All three blanks are filled."
          : `Blank ${snapshot.solved + 1} of ${BLANKS.length} — ${current?.prompt ?? ""}`}
      </p>

      <div className={s.form}>
        <label className="visually-hidden" htmlFor="blanks-input">
          Your answer
        </label>
        <input
          id="blanks-input"
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
          onClick={() => {
            runner.restart();
            clear();
            push("restart", "pending timer cancelled, back to blank 1");
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
          {Array.from({ length: Math.max(2, pending) }, (_, i) => (
            <span
              key={i}
              className={cx(
                s.slot,
                i < pending && s.slotFull,
                i < pending && i > 0 && s.slotExtra,
              )}
            >
              {i < pending ? `advance +${ADVANCE_MS}ms` : "empty"}
            </span>
          ))}
        </div>
      </div>

      <div className={sim.readouts}>
        <Readout
          name="timers queued"
          value={snapshot.advancesScheduled}
          tone={snapshot.advancesScheduled > snapshot.seen.length ? "broken" : "neutral"}
        />
        <Readout name="blank shown" value={`${Math.min(snapshot.solved + 1, 3)}/3`} />
        <Readout
          name="blanks skipped"
          value={snapshot.solved - snapshot.seen.filter((i) => i < snapshot.solved).length}
          tone={
            snapshot.solved >
            snapshot.seen.filter((i) => i < snapshot.solved).length
              ? "broken"
              : "fixed"
          }
        />
      </div>

      <EventLog entries={entries} label="Fill-in-the-blank event log" />
    </div>
  );
}
