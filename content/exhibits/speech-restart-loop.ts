import type { Exhibit } from "../schema";
import { MUSEUM_REPO } from "../schema";

const file = (path: string) => `${MUSEUM_REPO}/blob/main/${path}`;

const DEFINITION = file("content/exhibits/speech-restart-loop.ts");
const SIMULATION = file("components/sims/recogniser/recogniser-sim.tsx");
const LOGIC = file("lib/sims/restart-loop.ts");
const UNIT = file("tests/unit/sims/restart-loop.test.ts");

export const speechRestartLoop: Exhibit = {
  slug: "speech-restart-loop",
  number: 4,
  title: "The effect that stopped what it had just started",
  summary:
    "A React effect listed among its dependencies a state that its own side effect changed, so the speech recogniser started, cancelled itself, restarted, and transcribed almost nothing.",
  context: {
    label: "Voice session",
    description:
      "A live session that listens through the browser’s speech-recognition API and can switch language mid-sentence.",
  },
  categories: ["state", "async"],
  tech: ["React", "useEffect", "SpeechRecognition", "TypeScript", "Vitest"],
  simulation: "restart-loop",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "Every successful start immediately stops itself, about six times a second.",
      tryThis: [
        "Press Start listening and watch the engine ping-pong between starting and ending.",
        "Read the transcript and the event log: every fragment is cut off before it becomes a word.",
        "Step tick by tick to see which line re-arms the effect.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "The engine is bounced only when the language really changes, and the sentence arrives whole.",
      tryThis: [
        "Press Start listening: the engine starts once and stays running.",
        "Switch the language mid-sentence — one deliberate restart, then it continues.",
        "Compare the start and onend counts between the two states.",
      ],
    },
  ],

  whatHappened: [
    "A live `SpeechRecognition` object ignores changes to its `lang` property. Switching language therefore has to bounce the recogniser: set the new language, call `stop()`, and let the `onend` handler start it again.",
    "The effect that did this listed `isRecognizing` in its dependency array alongside `language`. That looks harmless — the effect reads `isRecognizing` to decide whether there is anything to stop.",
    "But `isRecognizing` changes because of what the effect does. Starting the recogniser set it to true, which re-ran the effect, which called `stop()`; `onend` set it back to false and restarted the recogniser, which set it to true again — and the effect ran once more. The engine ping-ponged roughly every 180ms and transcribed almost nothing: a stream of two-word fragments where a sentence should have been.",
    "It was found while chasing something else entirely: a pass over the session’s render hot path, looking for wasted work. An empty transcript had been read as “the browser’s speech recogniser is bad at this language”.",
  ],

  rootCause: [
    "Every reactive value an effect reads is a reason for it to run again, so the dependency array has to list it — that is what the lint rule enforces, and the rule was right. The mistake was reading `isRecognizing` at all: it was the one value the effect’s own side effect changed, so listing it meant every start re-ran the effect.",
    "Leaving it out of the array while still reading it would only have traded the loop for a stale closure. The corrected version stops reading it. It keys on `language` alone and keeps the last applied language in a ref, which an effect can read without depending on it. The ref is what makes the guard honest: the effect can re-run for any reason, and it only bounces the engine when the language it is looking at is genuinely different from the one currently applied.",
    "There is a second ref for a related reason. A stop issued while the session is being torn down must not be answered by `onend` starting it again, so `onend` checks a keep-listening ref rather than whatever its closure captured, and the effect checks the same ref before bouncing the engine.",
  ],

  excerpts: [
    {
      caption: "The dependency array, and the ref that makes it safe",
      kind: "diff",
      language: "ts",
      origin: "reproduction",
      lines: [
        "+  const langInUseRef = useRef(lang);",
        "   useEffect(() => {",
        "     const engine = engineRef.current;",
        "-    if (!engine) return;",
        "-    engine.lang = lang;",
        "-    if (isRecognizing) engine.stop(); // onend restarts it with the new lang",
        "-  }, [isRecognizing, lang]);",
        "+    const changed = langInUseRef.current !== lang;",
        "+    langInUseRef.current = lang;",
        "+    if (!engine || !changed) return;",
        "+    engine.lang = lang;",
        "+    // Bounce only a session that is meant to keep running; onend",
        "+    // brings it straight back with the new language.",
        "+    if (keepListeningRef.current) engine.stop();",
        "+  }, [lang]);",
      ],
    },
    {
      caption: "The comment worth leaving at the scene",
      kind: "code",
      language: "ts",
      origin: "reproduction",
      lines: [
        "// A live recogniser ignores changes to `lang`, so a language switch has",
        "// to stop it and let onend start it again with the new value.",
        "// Key this effect on the language alone, and do not read isRecognizing",
        "// in it: starting the recogniser changes isRecognizing, so reading it",
        "// made every successful start re-run the effect and stop the engine,",
        "// roughly every 180ms, and almost nothing was transcribed.",
      ],
    },
  ],

  test: {
    intro: [
      "The speech-recognition API does not exist in a Node test environment, so a test that drives the real hook would need a shim elaborate enough to be its own source of bugs. This is the exhibit where being straight about the limits of the evidence matters most.",
      "What the museum tests instead is the mechanism, isolated: `lib/sims/restart-loop.ts` models the engine’s start / end / restart-on-end cycle on a virtual 180ms tick, and runs it against both dependency arrays. That is a model, not the browser — but it is a model of the exact loop, and it is deterministic, so the difference between the two versions is a number rather than an impression.",
      "The broken version is asserted to produce more than four starts and more than four stops in twelve ticks, and to commit no words at all. The fixed version is asserted to start exactly once, stop zero times, and still bounce the engine exactly once for a real language change. Asserting both directions is the point: each version’s expectations fail against the other, so the suite can tell them apart.",
      "This is weaker evidence than a test that runs the real mechanism, as exhibit 01’s does in the browser, and the exhibit says so rather than implying otherwise.",
    ],
    excerpt: {
      caption: "tests/unit/sims/restart-loop.test.ts",
      kind: "code",
      language: "ts",
      origin: "museum-source",
      href: UNIT,
      lines: [
        "it(\"ping-pongs between start and end\", () => {",
        "  const run = runRecogniser(\"broken\", { ticks: 12 });",
        "",
        "  expect(run.starts).toBeGreaterThan(4);",
        "  expect(run.ends).toBeGreaterThan(4);",
        "  expect(countOf(run.events, \"stop\")).toBeGreaterThan(4);",
        "});",
        "",
        "it(\"starts once and stays running\", () => {",
        "  const run = runRecogniser(\"fixed\", { ticks: 12 });",
        "",
        "  expect(run.starts).toBe(1);",
        "  expect(run.ends).toBe(0);",
        "  expect(countOf(run.events, \"stop\")).toBe(0);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "The transcript was nearly empty",
      detail:
        "Noticed during a pass over the session’s render hot path. The engine produced two-word fragments; the working theory had been that the browser’s speech recogniser was simply poor at the language.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "fixed",
      title: "Key on the language alone",
      detail:
        "Stop reading the produced state, drop it from the dependency array, and track the applied language in a ref, so the engine is bounced only for a real language change.",
      source: { kind: "simulation-logic", label: "lib/sims/restart-loop.ts", href: LOGIC },
    },
    {
      phase: "regression-test",
      title: "Modelled, and labelled as a model",
      detail:
        "The browser API is absent from the Node test environment, so the cycle is modelled deterministically instead. The tests pin the loop in both directions; the exhibit does not claim more than that.",
      source: { kind: "regression-test", label: "tests/unit/sims/restart-loop.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/speech-restart-loop.ts",
      href: DEFINITION,
      note: "Every word on this page, as data.",
    },
    {
      kind: "simulation",
      label: "components/sims/recogniser/recogniser-sim.tsx",
      href: SIMULATION,
      note: "The tick strip, the event log and the transcript.",
    },
    {
      kind: "simulation-logic",
      label: "lib/sims/restart-loop.ts",
      href: LOGIC,
      note: "The engine model, and the two dependency arrays.",
    },
    {
      kind: "regression-test",
      label: "tests/unit/sims/restart-loop.test.ts",
      href: UNIT,
      note: "Both directions: the loop, and the single deliberate bounce.",
    },
  ],

  evidence:
    "A deterministic model of the start / end / restart cycle, run against both dependency arrays. It stands in for React and the speech API rather than running them — see the test section.",
  simulationNote:
    "There is no microphone here. The panel runs a deterministic model of the recogniser’s start / end / onend-restart cycle against the two dependency arrays, on a virtual clock you can step by hand. The 180ms tick is the model’s, chosen to match the interval the loop ran at. In the original, the odd two-word fragment still got through; in the model nothing survives long enough to become a word.",
};
