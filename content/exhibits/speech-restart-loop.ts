import type { Exhibit } from "../schema";

const REPO = "https://github.com/renrenmimi/ToneDown";
const COMMIT = `${REPO}/commit/1bf7f32`;
const MERGE = `${REPO}/commit/1e7f7f2`;
const HOOK = `${REPO}/blob/main/src/features/live-session/services/useSpeechRecognition.ts`;

export const speechRestartLoop: Exhibit = {
  slug: "speech-restart-loop",
  number: 4,
  title: "The effect that stopped what it had just started",
  summary:
    "A React effect listed the state it produced among its own dependencies, so the speech recogniser started, cancelled itself, restarted, and transcribed almost nothing.",
  project: {
    name: "ToneDown",
    repo: "renrenmimi/ToneDown",
    href: REPO,
    blurb:
      "A speaking-tone coach that listens through the browser's SpeechRecognition API.",
  },
  categories: ["state", "async"],
  tech: ["React", "useEffect", "Web Speech API", "TypeScript"],
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
        "Step frame by frame to see which line re-arms the effect.",
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
        "Compare the event counts in the two states.",
      ],
    },
  ],

  whatHappened: [
    "A live `SpeechRecognition` object ignores changes to its `lang` property. Switching language therefore has to bounce the recogniser: set the new language, call `stop()`, and let the `onend` handler start it again.",
    "The effect that did this listed `isRecognizing` in its dependency array alongside `language`. That looks harmless — the effect reads `isRecognizing` to decide whether there is anything to stop.",
    "But `isRecognizing` is the state the effect produces. Starting the recogniser set it to true, which re-ran the effect, which called `stop()`, which fired `onend`, which restarted the recogniser, which set `isRecognizing` true again. The fallback engine ping-ponged roughly every 180ms and transcribed almost nothing — a stream of two-word fragments where a sentence should have been.",
    "It was found while chasing something else entirely: a pass over the live session's hot path, looking for re-renders. The transcript being empty had been read as “the browser engine is bad at Chinese”.",
  ],

  rootCause: [
    "A dependency array is a statement about what the effect *reacts to*, not about what it *reads*. `isRecognizing` was in the array because the body mentioned it, which is the habit the lint rule teaches, and it happened to be the one value the effect itself caused to change.",
    "The corrected version keys on `language` alone and keeps the last applied language in a ref. The ref is what makes the guard honest: the effect can re-run for any reason, and it only bounces the engine when the language it is looking at is genuinely different from the one currently applied.",
    "There is a second guard for the same reason — `shouldRestartRef`. A stop issued while the session is being torn down must not be answered by `onend` starting it again.",
  ],

  excerpts: [
    {
      caption:
        "src/features/live-session/services/useSpeechRecognition.ts",
      kind: "diff",
      language: "ts",
      verbatim: true,
      href: HOOK,
      lines: [
        "+  const appliedLanguageRef = useRef(language)",
        "   useEffect(() => {",
        "-    if (!recognitionRef.current) {",
        "+    const recognition = recognitionRef.current",
        "+    if (!recognition) {",
        "+      appliedLanguageRef.current = language",
        "       return",
        "     }",
        "-    recognitionRef.current.lang = language",
        "+    recognition.lang = language",
        "",
        "-    if (isRecognizing) {",
        "-      try {",
        "-        recognitionRef.current.stop()",
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
      caption: "The comment left at the scene",
      kind: "code",
      language: "ts",
      verbatim: true,
      href: HOOK,
      lines: [
        "// A live SpeechRecognition ignores `lang` changes, so switching locale",
        "// has to bounce it — onend then restarts it with the new language.",
        "// This must key off the language ALONE: including isRecognizing made",
        "// every successful start immediately stop itself, and onend's restart",
        "// re-triggered the effect, so the fallback engine ping-ponged every",
        "// ~180ms and transcribed almost nothing.",
      ],
    },
  ],

  test: {
    intro: [
      "This one shipped without a unit test, and it is worth being straight about that: the hook is a thin wrapper over a browser API that does not exist in jsdom, and the fix was verified by driving a live session and reading the engine's event log.",
      "The museum's simulation is the closest thing to a regression test this bug has. It runs the two dependency arrays against a small deterministic model of the recogniser — start, end, restart-on-end — and the museum's own test suite asserts the broken version produces a start/end ping-pong while the fixed version produces exactly one start.",
      "If that sounds like a weaker standard than the other exhibits here, it is. It is listed as an exhibit because the mechanism is verifiable from the diff, not because the fix was proven by a test.",
    ],
    excerpt: {
      caption: "tests/unit/sims/restart-loop.test.ts (this museum, not ToneDown)",
      kind: "code",
      language: "ts",
      verbatim: false,
      lines: [
        "it(\"ping-pongs while isRecognizing is a dependency\", () => {",
        "  const log = runRecogniser(\"broken\", { ticks: 12 });",
        "",
        "  // start -> end -> start -> end ... roughly every 180ms",
        "  expect(countOf(log, \"start\")).toBeGreaterThan(4);",
        "  expect(countOf(log, \"end\")).toBeGreaterThan(4);",
        "  expect(transcriptOf(log)).not.toContain(\"whole sentence\");",
        "});",
        "",
        "it(\"starts once when the effect keys on language alone\", () => {",
        "  const log = runRecogniser(\"fixed\", { ticks: 12 });",
        "",
        "  expect(countOf(log, \"start\")).toBe(1);",
        "  expect(countOf(log, \"end\")).toBe(0);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "The transcript was nearly empty",
      detail:
        "Noticed during a pass over the live session's render hot path. The fallback engine produced two-word fragments; the working theory had been that the browser engine was simply poor.",
      source: { kind: "commit", label: "1bf7f32", href: COMMIT },
    },
    {
      phase: "fixed",
      title: "Key on the language alone",
      detail:
        "Drop `isRecognizing` from the dependency array and track the applied language in a ref, so the engine is bounced only for a real language change.",
      source: {
        kind: "file",
        label: "useSpeechRecognition.ts",
        href: HOOK,
      },
    },
    {
      phase: "regression-test",
      title: "Modelled here, not in ToneDown",
      detail:
        "No unit test was added upstream — the API is absent from jsdom. This museum models both dependency arrays and asserts the difference, which is the honest amount of coverage this bug has.",
      source: { kind: "commit", label: "1e7f7f2 — merge into main", href: MERGE },
    },
  ],

  sources: [
    {
      kind: "commit",
      label: "1bf7f32 — locale toggle alignment, responsive overflow, STT restart loop",
      href: COMMIT,
      note: "See the “Correctness” section of the message.",
    },
    { kind: "commit", label: "1e7f7f2 — merged into main", href: MERGE },
    {
      kind: "file",
      label: "src/features/live-session/services/useSpeechRecognition.ts",
      href: HOOK,
    },
  ],

  evidence:
    "ToneDown commit 1bf7f32, merged as 1e7f7f2. No upstream unit test — see the regression-test section.",
  simulationNote:
    "There is no microphone here. The panel runs a deterministic model of the recogniser's start / end / onend-restart cycle against the two dependency arrays, on a virtual clock you can step by hand.",
};
