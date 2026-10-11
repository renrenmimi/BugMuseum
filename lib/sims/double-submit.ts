/* ============================================================
   A guided exercise, reduced to the part that broke: a correct
   answer schedules an advance, and the form stays live for the
   length of the celebration.

   The clock is injected so the tests can assert on how many
   advances are queued, rather than waiting 700ms and inspecting
   where the counter stopped.
   ============================================================ */

export type SubmitVersion = "broken" | "fixed";

export interface Blank {
  id: number;
  prompt: string;
  answers: readonly string[];
  display: string;
  explain: string;
}

export const BLANKS: readonly Blank[] = [
  {
    id: 0,
    prompt:
      "The running total changes inside the loop, so it is declared with the block-scoped keyword …",
    answers: ["let"],
    display: "let",
    explain:
      "let is block-scoped and can be reassigned. Declared with const, the first sum += price would throw a TypeError.",
  },
  {
    id: 1,
    prompt: "The loop should visit the values of the array, not its indices, so it is written for (const price … prices) with …",
    answers: ["of"],
    display: "of",
    explain:
      "for…of yields each element. for…in would yield the indices as strings, and the total would turn into string concatenation.",
  },
  {
    id: 2,
    prompt: "The function hands the total back to its caller with …",
    answers: ["return"],
    display: "return",
    explain: "Without return, calling total(prices) evaluates to undefined.",
  },
];

export interface Clock {
  schedule(fn: () => void, ms: number): number;
  cancel(id: number): void;
}

/** A fake clock: nothing runs until you flush it. */
export function createManualClock() {
  let nextId = 1;
  const queue = new Map<number, { fn: () => void; ms: number }>();

  const clock: Clock = {
    schedule(fn, ms) {
      const id = nextId;
      nextId += 1;
      queue.set(id, { fn, ms });
      return id;
    },
    cancel(id) {
      queue.delete(id);
    },
  };

  return {
    clock,
    pending: () => queue.size,
    /** Runs every queued callback in scheduling order, once. */
    flush() {
      const ordered = [...queue.entries()].sort((a, b) => a[0] - b[0]);
      queue.clear();
      for (const [, item] of ordered) item.fn();
    },
  };
}

export type Feedback =
  | { kind: "idle" }
  | { kind: "right"; msg: string }
  | { kind: "wrong"; msg: string }
  | { kind: "hint"; msg: string };

export interface RunnerState {
  solved: number;
  value: string;
  feedback: Feedback;
  /** Every blank index the visitor was actually shown. */
  seen: number[];
  /** Blanks the exercise moved past without the visitor ever being asked them. */
  skipped: number[];
  advancesScheduled: number;
  advancesRun: number;
  /** Advances that have been scheduled and have not fired yet. */
  pending: number;
}

/** What one press of an entry point did — so the case can say so honestly. */
export type SubmitOutcome = "empty" | "wrong" | "scheduled" | "blocked" | "done";

export interface AdvanceInfo {
  /** The blank this advance moved past, or null when there was none left. */
  left: number | null;
  /** True when that blank went by before the visitor could answer it. */
  skipped: boolean;
  /** True when the timer was queued before the most recent restart. */
  stale: boolean;
}

export interface RestartInfo {
  /** Pending advances the restart cancelled. Only the fix can: it kept the id. */
  cancelled: number;
  /** Pending advances that will still fire after the restart. */
  stillPending: number;
}

export interface Runner {
  state(): RunnerState;
  current(): Blank | undefined;
  type(value: string): void;
  submit(): SubmitOutcome;
  reveal(): SubmitOutcome;
  restart(): RestartInfo;
  unmount(): void;
  onChange(fn: (state: RunnerState) => void): void;
  onAdvance(fn: (info: AdvanceInfo) => void): void;
}

const normalize = (v: string) => v.trim().toLowerCase();

export function createBlankRunner(
  version: SubmitVersion,
  clock: Clock,
  advanceMs = 700,
): Runner {
  let solved = 0;
  let value = "";
  let feedback: Feedback = { kind: "idle" };
  const seen = [0];
  let advancesScheduled = 0;
  let advancesRun = 0;

  /* The whole fix, in one variable: non-null means "advancing". Only the
     fixed handler reads it, and only the fixed handler can cancel through it. */
  let pendingAdvance: number | null = null;

  /* Instrumentation, not part of either handler: every advance that has been
     queued and has not fired, keyed by timer id, with the run it was queued
     in. The broken handler never kept these ids — the case keeps them only so
     it can draw the queue and say which timer fired. */
  const queue = new Map<number, number>();
  let run = 0;

  let listener: ((state: RunnerState) => void) | null = null;
  let advanceListener: ((info: AdvanceInfo) => void) | null = null;

  const skipped = () => {
    const out: number[] = [];
    for (let i = 0; i < solved; i += 1) {
      if (!seen.includes(i)) out.push(i);
    }
    return out;
  };

  const snapshot = (): RunnerState => ({
    solved,
    value,
    feedback,
    seen: [...seen],
    skipped: skipped(),
    advancesScheduled,
    advancesRun,
    pending: queue.size,
  });

  const notify = () => listener?.(snapshot());

  /** The blank on screen was seen, unless an advance is about to skip it. */
  const markShown = () => {
    if (solved < BLANKS.length && !seen.includes(solved)) seen.push(solved);
  };

  const advance = (id: number) => {
    const queuedIn = queue.get(id);
    queue.delete(id);
    if (pendingAdvance === id) pendingAdvance = null;
    advancesRun += 1;
    const stale = queuedIn !== run;

    /* An advance that fires after the last blank has nothing to move past.
       It still fired — that is the bug — but it cannot skip a fourth blank. */
    if (solved >= BLANKS.length) {
      advanceListener?.({ left: null, skipped: false, stale });
      notify();
      return;
    }

    const left = solved;
    const wasShown = seen.includes(left);
    solved += 1;
    /* Only count the next blank as shown if nothing else is about to skip past it. */
    if (queue.size === 0) markShown();
    value = "";
    feedback = { kind: "idle" };
    advanceListener?.({ left, skipped: !wasShown, stale });
    notify();
  };

  const queueAdvance = (ms: number): SubmitOutcome => {
    if (version === "fixed" && pendingAdvance !== null) return "blocked";
    advancesScheduled += 1;
    let id = 0;
    id = clock.schedule(() => advance(id), ms);
    queue.set(id, run);
    pendingAdvance = id;
    return "scheduled";
  };

  const current = () => BLANKS[solved];

  return {
    state: snapshot,
    current,
    onChange(fn) {
      listener = fn;
    },
    onAdvance(fn) {
      advanceListener = fn;
    },
    type(next) {
      value = next;
      notify();
    },
    submit() {
      if (version === "fixed" && pendingAdvance !== null) return "blocked";
      const blank = current();
      if (!blank) return "done";
      const got = normalize(value);
      if (got === "") return "empty";

      if (blank.answers.map(normalize).includes(got)) {
        feedback = { kind: "right", msg: blank.explain };
        /* Answering a blank means it was on screen to answer. */
        markShown();
        const outcome = queueAdvance(advanceMs);
        notify();
        return outcome;
      }
      feedback = { kind: "wrong", msg: "Not quite — try again." };
      notify();
      return "wrong";
    },
    reveal() {
      if (version === "fixed" && pendingAdvance !== null) return "blocked";
      const blank = current();
      if (!blank) return "done";
      feedback = {
        kind: "right",
        msg: `The answer is ${blank.display}. ${blank.explain}`,
      };
      markShown();
      const outcome = queueAdvance(advanceMs);
      notify();
      return outcome;
    },
    restart() {
      let cancelled = 0;
      if (version === "fixed" && pendingAdvance !== null) {
        clock.cancel(pendingAdvance);
        queue.delete(pendingAdvance);
        cancelled = 1;
      }
      /* The broken handler never kept a timer id, so it has nothing to cancel
         with: whatever it queued before the restart will still fire. */
      pendingAdvance = null;
      run += 1;
      solved = 0;
      value = "";
      feedback = { kind: "idle" };
      seen.length = 0;
      if (queue.size === 0) seen.push(0);
      /* Still queued, so still counted. */
      advancesScheduled = queue.size;
      advancesRun = 0;
      notify();
      return { cancelled, stillPending: queue.size };
    },
    unmount() {
      /* The other half of the fix: do not setState into a dead component. */
      if (version === "fixed" && pendingAdvance !== null) {
        clock.cancel(pendingAdvance);
        queue.delete(pendingAdvance);
        pendingAdvance = null;
      }
      /* The broken handler's timers outlive the component, as they did in the
         original. The case stops listening either way: it must not write into
         a component React has already unmounted. */
      listener = null;
      advanceListener = null;
    },
  };
}
