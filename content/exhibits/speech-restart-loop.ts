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
    "A React effect listed the state it produced among its own dependencies, so the speech recogniser started, cancelled itself, restarted, and transcribed almost nothing.",
  context: {
    label: "Voice session",
    description:
      "A live session that listens through the browser's speech-recognition API and can switch language mid-sentence.",
  },
  categories: ["state", "async"],
  tech: ["React", "useEffect", "SpeechRecognition", "TypeScript"],
  simulation: "restart-loop",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "Every successful start immediately stops itself, about six times a second.",
      tryThis: [
        "Press Start and watch the engine ping-pong between starting and ending.",
        "Read the transcript: fragments arrive and are cut off mid-word.",
        "Step tick by tick to see which line re-arms the effect.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "The effect only fires when the language really changed, and one sentence arrives whole.",
      tryThis: [
        "Press Start: the engine starts once and stays running.",
        "Switch the language mid-sentence — one deliberate restart, then it continues.",
        "Compare the start and onend counts between the two states.",
      ],
    },
  ],

  whatHappened: [
    "A live `SpeechRecognition` object ignores changes to its `lang` property. Switching language therefore has to bounce the recogniser: set the new language, call `stop()`, and let the `onend` handler start it again.",
    "The effect that did this listed `isRecognizing` in its dependency array alongside `language`. That looks harmless — the effect reads `isRecognizing` to decide whether there is anything to stop.",
    "But `isRecognizing` is the state the effect produces. Starting the recogniser set it to true, which re-ran the effect, which called `stop()`, which fired `onend`, which restarted the recogniser, which set `isRecognizing` true again. The engine ping-ponged roughly every 180ms and transcribed almost nothing — a stream of two-word fragments where a sentence should have been.",
    "It was found while chasing something else entirely: a pass over the session's render hot path, looking for wasted work. An empty transcript had been read as “the browser engine is bad at this language”.",
  ],

  rootCause: [
    "A dependency array is a statement about what an effect *reacts to*, not about what it *reads*. `isRecognizing` was in the array because the body mentioned it, which is the habit the lint rule teaches, and it happened to be the one value the effect itself caused to change.",
    "The corrected version keys on `language` alone and keeps the last applied language in a ref. The ref is what makes the guard honest: the effect can re-run for any reason, and it only bounces the engine when the language it is looking at is genuinely different from the one currently applied.",
    "There is a second guard for the same reason. A stop issued while the session is being torn down must not be answered by `onend` starting it again, so the restart is gated on a ref rather than on whatever the closure happened to capture.",
  ],

  excerpts: [
    {
      caption: "The dependency array, and the ref that makes it safe",
      kind: "diff",
      language: "ts",
      origin: "reproduction",
      lines: [
        "+  const appliedLanguageRef = useRef(language)",
        "   useEffect(() => {",
        "     const recognition = recognitionRef.current",
        "-    if (!recognition) {",
        "+    if (!recognition) {",
        "+      appliedLanguageRef.current = language",
        "       return",
        "     }",
        "     recognition.lang = language",
        "",
        "-    if (isRecognizing) {",
        "-      try {",
        "-        recognition.stop()",
        "-      } catch {",
        "-        // No-op: recognition may already be in transition.",
        "-      }",
        "+    if (appliedLanguageRef.current === language) {",
        "+      return",
        "     }",
        "-  }, [isRecognizing, language])",
        "+    appliedLanguageRef.current = language",
        "+    if (!shouldRestartRef.current) {",
        "+      return",
        "+    }",
        "+    try {",
        "+      recognition.stop()",
        "+    } catch {",
        "+      // No-op: recognition may already be in transition.",
        "+    }",
        "+  }, [language])",
      ],
    },
    {
      caption: "The comment worth leaving at the scene",
      kind: "code",
      language: "ts",
      origin: "reproduction",
      lines: [
        "// A live SpeechRecognition ignores `lang` changes, so switching locale",
        "// has to bounce it — onend then restarts it with the new language.",
        "// This must key off the language ALONE: including isRecognizing made",
        "// every successful start immediately stop itself, and onend's restart",
        "// re-triggered the effect, so the engine ping-ponged every ~180ms and",
        "// transcribed almost nothing.",
      ],
    },
  ],

  test: {
    intro: [
      "The speech-recognition API does not exist in a Node test environment, so a test that drives the real hook would need a shim elaborate enough to be its own source of bugs. This is the exhibit where being straight about the limits of the evidence matters most.",
      "What the museum tests instead is the mechanism, isolated: `lib/sims/restart-loop.ts` models the engine's start / end / restart-on-end cycle on a virtual 180ms tick, and runs it against both dependency arrays. That is a model, not the browser — but it is a model of the exact loop, and it is deterministic, so the difference between the two versions is a number rather than an impression.",
      "Eight cases. The broken version is asserted to produce more than four starts and more than four stops in twelve ticks and to commit no words at all; the fixed version is asserted to start exactly once, stop zero times, and still bounce the engine exactly once for a real language change. The negative assertions are the point: without them the tests would pass against either version.",
      "This is weaker evidence than the exhibits whose behaviour is driven end to end in a browser, and the exhibit says so rather than implying otherwise.",
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
        "Noticed during a pass over the session's render hot path. The engine produced two-word fragments; the working theory had been that the browser engine was simply poor at the language.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "fixed",
      title: "Key on the language alone",
      detail:
        "Drop the produced state from the dependency array and track the applied language in a ref, so the engine is bounced only for a real language change.",
      source: { kind: "simulation-logic", label: "lib/sims/restart-loop.ts", href: LOGIC },
    },
    {
      phase: "regression-test",
      title: "Modelled, and labelled as a model",
      detail:
        "The browser API is absent from the test environment, so the cycle is modelled deterministically instead. Eight cases pin the loop in both directions; the exhibit does not claim more than that.",
      source: { kind: "regression-test", label: "tests/unit/sims/restart-loop.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/speech-restart-loop.ts",
      href: DEFINITION,
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
      note: "Eight cases, in both directions.",
    },
  ],

  evidence:
    "A deterministic model of the start / end / restart cycle, run against both dependency arrays. Modelled rather than driven in a real browser — see the test section.",
  simulationNote:
    "There is no microphone here. The panel runs a deterministic model of the recogniser's start / end / onend-restart cycle against the two dependency arrays, on a virtual clock you can step by hand. The 180ms tick is the model's, chosen to match the interval the loop ran at.",
};
