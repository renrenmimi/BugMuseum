/* ============================================================
   A model of the browser's SpeechRecognition lifecycle, driven by
   the two dependency arrays. No microphone, no jsdom shim: just
   start / end / onend-restart on a virtual 180ms tick, which is
   the interval the real engine ping-ponged at.
   ============================================================ */

export type RecogniserVersion = "broken" | "fixed";

export type RecogniserEventKind =
  | "user"
  | "effect"
  | "start"
  | "stop"
  | "end"
  | "result"
  | "partial";

export interface RecogniserEvent {
  /** Virtual milliseconds since the session started. */
  t: number;
  kind: RecogniserEventKind;
  text: string;
}

export interface RunOptions {
  /** Number of 180ms ticks to run. */
  ticks: number;
  /** Tick at which the visitor switches language, if at all. */
  switchAt?: number;
}

export interface RunResult {
  events: RecogniserEvent[];
  transcript: string;
  starts: number;
  ends: number;
}

export const TICK_MS = 180;

const SENTENCE = [
  "I think",
  "we should",
  "probably revisit",
  "the timeline",
  "before Friday",
];

/** A result needs the engine to stay up for two consecutive ticks. */
const TICKS_PER_RESULT = 2;

export function runRecogniser(
  version: RecogniserVersion,
  { ticks, switchAt }: RunOptions,
): RunResult {
  const events: RecogniserEvent[] = [];
  const emit = (t: number, kind: RecogniserEventKind, text: string) =>
    events.push({ t, kind, text });

  let running = false;
  let language = "en-US";
  let appliedLanguage = language;
  let ticksRunning = 0;
  let phrase = 0;
  const words: string[] = [];
  let starts = 0;
  let ends = 0;
  /** onend restarts the engine unless the session is being torn down. */
  const shouldRestart = true;

  /**
   * The effect body. `deps` is the whole exhibit: the broken version lists
   * the state it produces, so starting re-runs it.
   */
  const runEffect = (t: number) => {
    if (version === "broken") {
      emit(t, "effect", "effect ran — deps [isRecognizing, language]");
      if (running) {
        emit(t, "stop", "recognition.stop()");
        running = false;
        ends += 1;
        emit(t, "end", "onend fired");
        if (shouldRestart) {
          // onend restarts on the next tick with the new language.
          restartAt = t + TICK_MS;
        }
      }
      return;
    }

    emit(t, "effect", "effect ran — deps [language]");
    if (appliedLanguage === language) {
      emit(t, "effect", "same language as applied — returning early");
      return;
    }
    appliedLanguage = language;
    if (!running) return;
    emit(t, "stop", "recognition.stop() — deliberate language bounce");
    running = false;
    ends += 1;
    emit(t, "end", "onend fired");
    restartAt = t + TICK_MS;
  };

  let restartAt: number | null = null;

  const startEngine = (t: number) => {
    running = true;
    ticksRunning = 0;
    starts += 1;
    emit(t, "start", `recognition.start() — lang ${language}`);
    // Starting sets isRecognizing, which is a dependency in one version.
    if (version === "broken") runEffect(t);
  };

  emit(0, "user", "pressed Start");
  startEngine(0);

  for (let tick = 1; tick <= ticks; tick += 1) {
    const t = tick * TICK_MS;

    if (restartAt !== null && t >= restartAt) {
      restartAt = null;
      startEngine(t);
    }

    if (switchAt === tick) {
      language = language === "en-US" ? "zh-CN" : "en-US";
      emit(t, "user", `switched language to ${language}`);
      runEffect(t);
    }

    if (running) {
      ticksRunning += 1;
      if (ticksRunning % TICKS_PER_RESULT === 0 && phrase < SENTENCE.length) {
        const word = SENTENCE[phrase];
        if (word !== undefined) {
          words.push(word);
          emit(t, "result", `"${word}"`);
        }
        phrase += 1;
      }
    } else if (version === "broken" && tick % 2 === 0 && phrase < SENTENCE.length) {
      // A cut-off utterance: the engine heard the start of a word and was
      // stopped before it could commit a result.
      const word = SENTENCE[phrase];
      if (word !== undefined) {
        emit(t, "partial", `"${word.slice(0, 2)}…" discarded`);
      }
    }
  }

  return {
    events,
    transcript: words.join(" "),
    starts,
    ends,
  };
}

export function countOf(
  events: readonly RecogniserEvent[],
  kind: RecogniserEventKind,
): number {
  return events.filter((e) => e.kind === kind).length;
}
