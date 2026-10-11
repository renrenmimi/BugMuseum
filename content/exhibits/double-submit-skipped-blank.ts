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
    "So a second Enter — key repeat, an impatient double tap, a habit learned from ordinary web forms — passed the same check again and scheduled a second `setTimeout`. Both fired. The step counter advanced twice, and the next blank was answered by nobody and shown to nobody.",
  ],

  rootCause: [
    "The delay is a piece of state that nothing was tracking. Between the answer and the advance, the component is in a real mode — “celebrating, about to move on” — and the code represented it only as a timer id nobody held on to.",
    "The fix is to hold on to it. A ref stores the pending timer; a non-null ref means “in transition” and every entry point returns early while it is set. Restarting clears it, and an unmount effect clears it too, so leaving the page cannot schedule a state update into a component that is gone.",
    "A ref is the right home for the guard, for two reasons. Restart and unmount need the timer id to cancel it, so it has to live somewhere that survives renders without causing one. And a ref takes effect the moment it is written, so two calls that arrive inside a single event — as they do when this case’s “Press Enter twice” button calls the handler twice — are both stopped. A state flag would have stopped two separate key presses, because React commits the first key press’s update before it handles the second; it would not stop two calls made within one event.",
  ],

  excerpts: [
    {
      caption: "The mutex",
      kind: "diff",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "+  // While this holds a timer id, an advance is on its way and every",
        "+  // way of moving on is closed.",
        "+  const pendingAdvance = useRef<ReturnType<typeof setTimeout> | null>(null);",
        "+",
        "+  function queueAdvance(delay: number) {",
        "+    if (pendingAdvance.current !== null) return;",
        "+    pendingAdvance.current = setTimeout(() => {",
        "+      pendingAdvance.current = null;",
        "+      setStep((n) => n + 1);",
        "+      setMessage(null);",
        "+    }, delay);",
        "+  }",
        "",
        "   function onSubmit(event: FormEvent) {",
        "     event.preventDefault();",
        "+    if (pendingAdvance.current !== null) return;",
        "     if (!isCorrect(input, blank)) return showHint();",
        "     setMessage(blank.why);",
        "-    setTimeout(() => {",
        "-      setStep((n) => n + 1);",
        "-      setMessage(null);",
        "-    }, 1400);",
        "+    queueAdvance(1400);",
        "   }",
      ],
    },
    {
      caption: "And the timer that outlived the page",
      kind: "code",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "useEffect(() => () => {",
        "  // Leaving the exercise cancels an advance that has not happened yet.",
        "  if (pendingAdvance.current !== null) clearTimeout(pendingAdvance.current);",
        "}, []);",
      ],
    },
  ],

  test: {
    intro: [
      "The obvious assertion — “the step counter ended up at 1” — is the wrong one. It would still pass if the second timer had been scheduled and happened to be harmless, and the second timer is the defect.",
      "So `lib/sims/double-submit.ts` takes its clock as a parameter. The tests hand it a queue that runs nothing until flushed, which makes “how many advances are pending right now” something you can assert on directly, without waiting.",
      "The broken cases carry their weight: two submits must queue two timers, and after flushing, the blank between them must never appear in the list of blanks the visitor was shown. Under the fix the same input queues one, and Reveal is blocked during the window too. Restart and unmount are covered for both handlers: the fix cancels the one advance it holds, while the broken handler, which never kept a timer id, has nothing to cancel, and every advance it queued still fires.",
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
        "The clock is injected, so the tests assert how many advances are pending rather than what the counter settled on, for both handlers.",
      source: { kind: "regression-test", label: "tests/unit/sims/double-submit.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/double-submit-skipped-blank.ts",
      href: DEFINITION,
      note: "Every word on this page, as data.",
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
      note: "The broken cases assert two queued timers.",
    },
  ],

  evidence:
    "Both handlers run over an injected clock, so “two timers were queued” is asserted directly rather than inferred from where the counter stopped.",
  simulationNote:
    "The exercise in the case is a short three-blank stand-in written for this museum, not the original exercise. It runs both submit handlers, with the advance delay shortened from 1400ms to 700ms so the demonstration is not tedious, and draws the timer queue as it fills.",
};
