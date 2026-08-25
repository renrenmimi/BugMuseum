import type { Exhibit } from "../schema";
import { MUSEUM_REPO } from "../schema";

const file = (path: string) => `${MUSEUM_REPO}/blob/main/${path}`;

const DEFINITION = file("content/exhibits/double-submit-skipped-blank.ts");
const SIMULATION = file("components/sims/blanks/blanks-sim.tsx");
const LOGIC = file("lib/sims/double-submit.ts");
const UNIT = file("tests/unit/sims/double-submit.test.ts");

export const doubleSubmitSkippedBlank: Exhibit = {
  slug: "double-submit-skipped-blank",
  number: 6,
  title: "Two presses of Enter, one question you never saw",
  summary:
    "A delay before advancing to the next blank left the form live, so a second Enter queued a second timer and skipped a question entirely.",
  context: {
    label: "Guided coding exercise",
    description:
      "A teaching exercise that builds up a piece of code one fill-in-the-blank at a time.",
  },
  categories: ["state", "concurrency"],
  tech: ["React", "setTimeout", "Keyboard input", "Vitest"],
  simulation: "double-submit",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "Every Enter during the celebration window queues another advance.",
      tryThis: [
        "Answer the blank, then press Enter twice quickly.",
        "Watch the timer queue grow and the blank counter jump by two.",
        "Notice which question you never got asked.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "The first Enter takes the lock; anything during the window is ignored.",
      tryThis: [
        "Answer and press Enter twice — the counter still moves one step.",
        "Try the Reveal control during the window too.",
        "Restart mid-window and confirm the pending timer is cancelled.",
      ],
    },
  ],

  whatHappened: [
    "The exercise asks you to fill in missing pieces of a program. Get one right and the explanation stays on screen for about a second and a half before the next blank slides in — long enough to actually read it.",
    "The form stayed interactive for that window. The input still had focus, the submit handler was still wired up, and the answer you had just typed was still in the box and still correct.",
    "So a second Enter — key repeat, an impatient double tap, a habit from every other form on the internet — passed the same check again and scheduled a second `setTimeout`. Both fired. The step counter advanced twice, and the next blank was answered by nobody and shown to nobody.",
    "The same session turned up a second symptom in the same interface: a counter that animated from the previous *target* rather than from the number actually on screen, so clicking through quickly snapped the display to a value it had never shown.",
  ],

  rootCause: [
    "The delay is a piece of state that nothing was tracking. Between the answer and the advance, the component is in a real mode — “celebrating, about to move on” — and the code represented it only as a timer id nobody held on to.",
    "The fix is to hold on to it. A ref stores the pending timer; a non-null ref means “in transition” and every entry point returns early while it is set. Restarting clears it, and an unmount effect clears it too, so leaving the page cannot schedule a state update into a component that is gone.",
    "Guarding with React state instead of a ref would not have worked. Two Enters in the same tick both read the state as it was before either commit; a ref is written synchronously, which is the whole reason to reach for one.",
  ],

  excerpts: [
    {
      caption: "The mutex",
      kind: "diff",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "+  // Non-null means \"advancing\": blocks repeat submits in the window.",
        "+  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);",
        "+",
        "+  const scheduleAdvance = (ms: number) => {",
        "+    if (advanceTimer.current) return;",
        "+    advanceTimer.current = setTimeout(() => {",
        "+      advanceTimer.current = null;",
        "+      setSolved((s) => s + 1);",
        "+      setFeedback({ kind: \"idle\", msg: \"\" });",
        "+    }, ms);",
        "+  };",
        "",
        "   const submit = (e?: FormEvent) => {",
        "     e?.preventDefault();",
        "+    if (advanceTimer.current) return;",
        "     if (!current) return;",
        "",
        "     if (current.answers.map(normalize).includes(got)) {",
        "       setFeedback({ kind: \"right\", msg: current.explain });",
        "-      setTimeout(() => {",
        "-        setSolved((s) => s + 1);",
        "-        setFeedback({ kind: \"idle\", msg: \"\" });",
        "-      }, 1400);",
        "+      scheduleAdvance(1400);",
        "       return;",
        "     }",
      ],
    },
    {
      caption: "And the timer that outlived the page",
      kind: "code",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "useEffect(() => {",
        "  return () => {",
        "    if (advanceTimer.current) clearTimeout(advanceTimer.current);",
        "  };",
        "}, []);",
      ],
    },
    {
      caption: "The neighbouring symptom: a counter animating from the wrong number",
      kind: "diff",
      language: "tsx",
      origin: "reproduction",
      lines: [
        " function useCountUp(target: number, ms = 700) {",
        "   const [val, setVal] = useState(target);",
        "-  const prev = useRef(target);",
        "+  const shown = useRef(target);   // what is on screen, not last target",
        "   useEffect(() => {",
        "-    const from = prev.current;",
        "-    prev.current = target;",
        "+    const from = shown.current;",
        "     if (from === target) return;",
        "     const tick = (t: number) => {",
        "-      setVal(Math.round(from + (target - from) * eased));",
        "+      const next = Math.round(from + (target - from) * eased);",
        "+      shown.current = next;",
        "+      setVal(next);",
        "     };",
        "   }, [target, ms]);",
        " }",
      ],
    },
  ],

  test: {
    intro: [
      "The obvious assertion — “the counter ended up at 1” — is the wrong one. It would still pass if the second timer had been scheduled and happened to be harmless, and the defect *is* the second timer.",
      "So `lib/sims/double-submit.ts` takes its clock as a parameter. The tests hand it a queue that runs nothing until flushed, which makes “how many advances are pending right now” something you can assert on directly, without waiting.",
      "Ten cases, and the broken ones carry their weight: two submits must queue two timers, and after flushing, the blank between them must never appear in the list of blanks the visitor was shown. Under the fix the same input queues one, and Reveal is blocked during the window too. Restart and unmount are covered as well, because a cancelled timer that still fires is the same bug wearing a different hat.",
    ],
    excerpt: {
      caption: "tests/unit/sims/double-submit.test.ts",
      kind: "code",
      language: "ts",
      origin: "museum-source",
      href: UNIT,
      lines: [
        "it(\"skips the blank between the two advances\", () => {",
        "  const { runner, pending, flush } = setup(\"broken\");",
        "  answer(runner);",
        "  runner.submit();",
        "  runner.submit();",
        "  flush();",
        "",
        "  expect(runner.state().solved).toBe(2);",
        "  expect(runner.state().seen).not.toContain(1);",
        "  expect(pending()).toBe(0);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "A blank nobody was asked",
      detail:
        "Pressing Enter twice after a correct answer skipped past the following blank. Reproducible by holding the key down, which is how it was most likely being hit in practice.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "fixed",
      title: "A ref that means “in transition”",
      detail:
        "One pending timer at a time, checked by every entry point, cancelled on restart, and cleared on unmount.",
      source: { kind: "simulation-logic", label: "lib/sims/double-submit.ts", href: LOGIC },
    },
    {
      phase: "regression-test",
      title: "Assert the queue, not the outcome",
      detail:
        "The clock is injected, so the tests assert how many advances are pending rather than what the counter settled on. Ten cases across both handlers.",
      source: { kind: "regression-test", label: "tests/unit/sims/double-submit.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/double-submit-skipped-blank.ts",
      href: DEFINITION,
    },
    {
      kind: "simulation",
      label: "components/sims/blanks/blanks-sim.tsx",
      href: SIMULATION,
      note: "The exercise, and the timer queue drawn as it fills.",
    },
    {
      kind: "simulation-logic",
      label: "lib/sims/double-submit.ts",
      href: LOGIC,
      note: "Both submit handlers, over an injectable clock.",
    },
    {
      kind: "regression-test",
      label: "tests/unit/sims/double-submit.test.ts",
      href: UNIT,
      note: "Ten cases; the broken ones assert two queued timers.",
    },
  ],

  evidence:
    "Both handlers run over an injected clock, so “two timers were queued” is asserted directly rather than inferred from where the counter stopped.",
  simulationNote:
    "The exercise in the case is a three-blank version of the original, running both submit handlers, with the advance delay shortened to 700ms so the demonstration is not tedious. The timer queue is drawn as it fills.",
};
