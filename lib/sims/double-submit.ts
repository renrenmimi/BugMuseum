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
    prompt: "The loop keeps every turn in one growing array called …",
    answers: ["messages"],
    display: "messages",
    explain: "Each turn is appended, so the model sees the whole conversation.",
  },
  {
    id: 1,
    prompt: "A turn ends when stop_reason is not …",
    answers: ["tool_use"],
    display: "tool_use",
    explain: "Anything else means the model is done and wants to answer.",
  },
  {
    id: 2,
    prompt: "A tool result is pushed back with the role …",
    answers: ["user"],
    display: "user",
    explain: "Tool results arrive as a user turn; that is the API's convention.",
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
  advancesScheduled: number;
  advancesRun: number;
}

export interface Runner {
  state(): RunnerState;
  current(): Blank | undefined;
  type(value: string): void;
  submit(): void;
  reveal(): void;
  restart(): void;
  unmount(): void;
  onChange(fn: (state: RunnerState) => void): void;
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

  /* The whole fix, in one variable: non-null means "advancing". */
  let advanceTimer: number | null = null;
  /* How many advances are queued. Two queued at once means the blank
     between them is rendered for one frame and is, in practice, never seen. */
  let queued = 0;
  let listener: ((state: RunnerState) => void) | null = null;

  const snapshot = (): RunnerState => ({
    solved,
    value,
    feedback,
    seen: [...seen],
    advancesScheduled,
    advancesRun,
  });

  const notify = () => listener?.(snapshot());

  const advance = () => {
    advanceTimer = null;
    queued -= 1;
    advancesRun += 1;
    solved += 1;
    /* Only count it as shown if nothing else is about to skip past it. */
    if (queued === 0 && solved < BLANKS.length && !seen.includes(solved)) {
      seen.push(solved);
    }
    value = "";
    feedback = { kind: "idle" };
    notify();
  };

  const scheduleAdvance = (ms: number) => {
    if (version === "fixed" && advanceTimer !== null) return;
    advancesScheduled += 1;
    queued += 1;
    advanceTimer = clock.schedule(advance, ms);
  };

  const current = () => BLANKS[solved];

  return {
    state: snapshot,
    current,
    onChange(fn) {
      listener = fn;
    },
    type(next) {
      value = next;
      notify();
    },
    submit() {
      if (version === "fixed" && advanceTimer !== null) return;
      const blank = current();
      if (!blank) return;
      const got = normalize(value);
      if (got === "") return;

      if (blank.answers.map(normalize).includes(got)) {
        feedback = { kind: "right", msg: blank.explain };
        scheduleAdvance(advanceMs);
      } else {
        feedback = { kind: "wrong", msg: "Not quite — try again." };
      }
      notify();
    },
    reveal() {
      if (version === "fixed" && advanceTimer !== null) return;
      const blank = current();
      if (!blank) return;
      feedback = {
        kind: "right",
        msg: `The answer is ${blank.display}. ${blank.explain}`,
      };
      scheduleAdvance(advanceMs);
      notify();
    },
    restart() {
      if (advanceTimer !== null) {
        clock.cancel(advanceTimer);
        advanceTimer = null;
      }
      queued = 0;
      solved = 0;
      value = "";
      feedback = { kind: "idle" };
      seen.length = 0;
      seen.push(0);
      advancesScheduled = 0;
      advancesRun = 0;
      notify();
    },
    unmount() {
      /* The other half of the fix: do not setState into a dead component. */
      if (advanceTimer !== null) {
        clock.cancel(advanceTimer);
        advanceTimer = null;
        queued = 0;
      }
      listener = null;
    },
  };
}
