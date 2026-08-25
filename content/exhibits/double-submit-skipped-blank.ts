import type { Exhibit } from "../schema";

const REPO = "https://github.com/renrenmimi/AgentLab";
const COMMIT = `${REPO}/commit/cbe3058d6445440d7ebbe5f072028ddc5eea5596`;
const BUILD = `${REPO}/blob/main/app/build/page.tsx`;
const CLAUDE_MD = `${REPO}/blob/main/CLAUDE.md`;

export const doubleSubmitSkippedBlank: Exhibit = {
  slug: "double-submit-skipped-blank",
  number: 6,
  title: "Two presses of Enter, one question you never saw",
  summary:
    "A 1.4-second delay before advancing to the next blank left the form live, so a second Enter queued a second timer and skipped a question entirely.",
  project: {
    name: "AgentLab",
    repo: "renrenmimi/AgentLab",
    href: REPO,
    blurb:
      "A teaching site that builds up an agent loop one fill-in-the-blank at a time.",
  },
  categories: ["state", "concurrency"],
  tech: ["React", "Next.js", "setTimeout", "Keyboard input"],
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
        "Answer and hold Enter down — the counter still moves one step.",
        "Try the Hint and Reveal buttons during the window too.",
        "Restart mid-window and confirm the pending timer is cancelled.",
      ],
    },
  ],

  whatHappened: [
    "AgentLab's build chapter asks you to fill in the missing pieces of an agent loop. Get one right and the explanation appears for 1.4 seconds before the next blank slides in — long enough to actually read it.",
    "The form stayed interactive for those 1.4 seconds. The input still had focus, the submit handler was still wired up, and the answer you had just typed was still in the box and still correct.",
    "So a second Enter — key repeat, an impatient double tap, a habit from every other form on the internet — passed the same check again and scheduled a second `setTimeout`. Both fired. `setSolved(s => s + 1)` ran twice, and the third blank was answered by nobody and shown to nobody.",
    "The same commit fixed a second symptom in the neighbouring chapter: a token counter animated from the previous *target* rather than from the number actually on screen, so clicking through quickly made the number snap to a value it had never displayed before continuing.",
  ],

  rootCause: [
    "The 1.4-second delay is a piece of state that nothing was tracking. Between the answer and the advance, the component is in a real mode — “celebrating, about to move on” — and the code represented it only as a timer id nobody held on to.",
    "The fix is to hold on to it. A ref stores the pending timer; a non-null ref means “in transition” and every entry point — submit, hint, reveal — returns early while it is set. `restart` clears it, and an unmount effect clears it too, so leaving the page cannot schedule a `setState` into a component that is gone.",
    "Guarding with React state instead of a ref would not have worked. Two Enters in the same tick both read the state as it was before either commit; a ref is written synchronously, which is the whole reason to reach for one.",
  ],

  excerpts: [
    {
      caption: "app/build/page.tsx — the mutex",
      kind: "diff",
      language: "tsx",
      verbatim: true,
      href: BUILD,
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
        "       setFeedback({ kind: \"right\", msg: t(current.explain, lang) });",
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
      caption: "app/build/page.tsx — and the timer that outlived the page",
      kind: "code",
      language: "tsx",
      verbatim: true,
      href: BUILD,
      lines: [
        "useEffect(() => {",
        "  return () => {",
        "    if (advanceTimer.current) clearTimeout(advanceTimer.current);",
        "  };",
        "}, []);",
      ],
    },
    {
      caption: "app/loop/page.tsx — the counter, from the same commit",
      kind: "diff",
      language: "tsx",
      verbatim: true,
      href: `${REPO}/blob/main/app/loop/page.tsx`,
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
      "AgentLab has no test suite — it is a small teaching site, and the fix was verified by hand. Saying so is more useful than implying otherwise.",
      "What the museum can do is pin the behaviour that was fixed. The simulation runs both versions of the submit handler against a fake timer queue, and the museum's tests assert that two submits inside the window advance the counter by one under the fix and by two without it.",
      "The interesting assertion is not “the counter is 1”. It is “exactly one timer was scheduled” — the counter being right is a consequence, and testing the consequence would still pass if the second timer had been scheduled and happened to be harmless.",
    ],
    excerpt: {
      caption: "tests/unit/sims/double-submit.test.ts (this museum)",
      kind: "code",
      language: "ts",
      verbatim: false,
      lines: [
        "it(\"queues one advance per correct answer\", () => {",
        "  const run = createBlankRunner(\"fixed\");",
        "  run.type(\"messages\");",
        "  run.submit();",
        "  run.submit();   // the impatient second Enter",
        "",
        "  expect(run.pendingTimers()).toBe(1);",
        "  run.flush();",
        "  expect(run.solved()).toBe(1);",
        "});",
        "",
        "it(\"queues two without the mutex, and skips a blank\", () => {",
        "  const run = createBlankRunner(\"broken\");",
        "  run.type(\"messages\");",
        "  run.submit();",
        "  run.submit();",
        "",
        "  expect(run.pendingTimers()).toBe(2);",
        "  run.flush();",
        "  expect(run.solved()).toBe(2);",
        "  expect(run.seenBlanks()).not.toContain(1);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "A blank nobody was asked",
      detail:
        "Pressing Enter twice after a correct answer skipped past the following blank. Reproduced by holding the key down, which is how it was most likely being hit in practice.",
      source: { kind: "commit", label: "cbe3058", href: COMMIT },
    },
    {
      phase: "fixed",
      title: "A ref that means “in transition”",
      detail:
        "One pending timer at a time, checked by submit, hint and reveal, cancelled by restart, and cleared on unmount.",
      source: { kind: "file", label: "app/build/page.tsx", href: BUILD },
    },
    {
      phase: "regression-test",
      title: "Pinned here, by hand there",
      detail:
        "AgentLab has no test suite; the fix was checked manually. The museum's simulation runs both handlers against a fake clock and asserts the number of scheduled timers.",
      source: { kind: "file", label: "AgentLab CLAUDE.md", href: CLAUDE_MD },
    },
  ],

  sources: [
    {
      kind: "commit",
      label: "cbe3058 — skipped blanks, backwards counter, per-frame highlighting",
      href: COMMIT,
      note: "Commit message is in Chinese; the first two bullets cover this exhibit.",
    },
    { kind: "file", label: "app/build/page.tsx", href: BUILD },
    { kind: "file", label: "app/loop/page.tsx", href: `${REPO}/blob/main/app/loop/page.tsx` },
  ],

  evidence:
    "AgentLab commit cbe3058 on main. No upstream tests — the behaviour is pinned by this museum's simulation instead.",
  simulationNote:
    "The exercise in the case is a three-blank copy of AgentLab's build chapter running both submit handlers, with the advance delay shortened from 1,400ms to 700ms so the demonstration is not tedious. The timer queue is drawn as it fills.",
};
