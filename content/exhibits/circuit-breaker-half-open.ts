import type { Exhibit } from "../schema";
import { MUSEUM_REPO } from "../schema";

const file = (path: string) => `${MUSEUM_REPO}/blob/main/${path}`;

const DEFINITION = file("content/exhibits/circuit-breaker-half-open.ts");
const SIMULATION = file("components/sims/breaker/breaker-sim.tsx");
const LOGIC = file("lib/sims/circuit-breaker.ts");
const UNIT = file("tests/unit/sims/circuit-breaker.test.ts");

export const circuitBreakerHalfOpen: Exhibit = {
  slug: "circuit-breaker-half-open",
  number: 2,
  title: "The circuit breaker that could never close again",
  summary:
    "Asking a circuit breaker whether a request was allowed consumed the one probe that would have let it recover.",
  context: {
    label: "API resilience layer",
    description:
      "The client layer of an app that calls several remote endpoints while a session is live, with a breaker in front of each group.",
  },
  categories: ["async", "testing", "state"],
  tech: ["TypeScript", "Circuit breaker", "Vitest"],
  simulation: "circuit-breaker",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "A caller that asks and then walks away leaves the breaker stuck half-open forever.",
      tryThis: [
        "Fail three requests to open the circuit, then let the backoff elapse.",
        "Press “Pre-flight check” — the answer is yes, and it costs you the probe.",
        "Now send a real request: it is refused, and no amount of waiting helps.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "Asking is free. The probe slot is reserved at the moment a request goes out.",
      tryThis: [
        "Repeat the same sequence: pre-flight as many times as you like.",
        "Send a request afterwards — it goes through and closes the circuit.",
        "Fail the probe instead, and watch the backoff double rather than stick.",
      ],
    },
  ],

  whatHappened: [
    "Each group of remote endpoints sat behind a three-state circuit breaker: closed, open after three consecutive failures, then half-open once a backoff had elapsed to let a single probe through. A successful probe closes the circuit; a failed one reopens it with a doubled backoff. It is a textbook design and it was implemented correctly.",
    "In the app, several call sites pre-flighted with `canAttempt()` before deciding whether it was even worth assembling a request — request pacing, input too short to be worth sending, a budget check that had already been answered. Only some of them then went on to call.",
    "`canAttempt()` performed the open → half-open transition as a side effect of being asked. So a caller that asked and then bailed out left the breaker half-open with no probe in flight — and in half-open state `canAttempt()` returns false. Nothing was ever going to report back, so nothing was ever going to close the circuit. A caller that did proceed was rejected too, by the client's own guard, because the pre-flight had already consumed the transition.",
    "Breakers were module-scoped, so every endpoint behind one stayed dead until a full page reload. A degraded-mode fallback designed to be temporary had quietly become permanent.",
  ],

  rootCause: [
    "A query that mutates. `canAttempt()` reads like a question and behaves like a claim, so every caller who merely wondered whether a request was worth making silently took the last one.",
    "The two responsibilities are genuinely different: *may a request be issued right now* is a property of the breaker, and *I am issuing one, hold the slot for me* is a transaction. Merging them means the answer depends on who else has asked.",
    "The fix splits them. `canAttempt()` becomes a pure query — and explicitly returns false in half-open, because a probe is already in flight and it alone decides the next transition. `beginAttempt()` reserves the slot, and is called from exactly one place: the line where a request really goes out.",
  ],

  excerpts: [
    {
      caption: "The question that answered itself",
      kind: "diff",
      language: "ts",
      origin: "reproduction",
      lines: [
        "   canAttempt(now: number = Date.now()): boolean {",
        "     if (this.state === 'closed') {",
        "       return true",
        "     }",
        "-    if (this.state === 'open' && now >= this.nextProbeAt) {",
        "-      this.state = 'half-open'",
        "-      return true",
        "+    if (this.state === 'half-open') {",
        "+      // A probe is already in flight; it alone decides what happens next.",
        "+      return false",
        "     }",
        "-    return false",
        "+    return now >= this.nextProbeAt",
        "   }",
      ],
    },
    {
      caption: "And the claim, made explicit",
      kind: "code",
      language: "ts",
      origin: "reproduction",
      lines: [
        "/**",
        " * Reserve the attempt slot for a request that is actually being issued",
        " * now, moving an elapsed open circuit to half-open. The caller MUST then",
        " * reach recordSuccess() or recordFailure() on every path — a reserved",
        " * probe that never reports back leaves the breaker half-open forever.",
        " */",
        "beginAttempt(now: number = Date.now()): boolean {",
        "  if (!this.canAttempt(now)) {",
        "    return false",
        "  }",
        "  if (this.state === 'open') {",
        "    this.state = 'half-open'",
        "  }",
        "  return true",
        "}",
      ],
    },
    {
      caption: "One line, at the only honest place",
      kind: "diff",
      language: "ts",
      origin: "reproduction",
      lines: [
        "-      if (!breaker.canAttempt()) {",
        "+      // beginAttempt, not canAttempt: this is the point where a request",
        "+      // really goes out, so this is where the probe slot gets reserved.",
        "+      if (!breaker.beginAttempt()) {",
        "         throw new BreakerOpenError(spec.breaker)",
        "       }",
      ],
    },
  ],

  test: {
    intro: [
      "This is the exhibit where a passing test suite was part of the problem. Unit tests around the breaker class existed and stayed green the whole time, because they called `canAttempt()` once per backoff window and then recorded a result — a reasonable way to test a state machine, and not how the application used it.",
      "So the museum's version tests the *endpoint*, not the class in isolation, and reproduces the shape the app actually had: pre-flight, decide not to call, pre-flight again, and only then send a request. Both implementations are in the case, driven by a virtual clock, and the same two objects are what the tests drive.",
      "The assertion that matters is the negative one. It is not enough to show the fixed breaker recovers; the test also pins that the broken one is *permanently* stranded — ten idle minutes later, still refusing. A test that only checked the happy path would have passed against both.",
    ],
    excerpt: {
      caption: "tests/unit/sims/circuit-breaker.test.ts",
      kind: "code",
      language: "ts",
      origin: "museum-source",
      href: UNIT,
      lines: [
        "it(\"is stranded by a pre-flight that never becomes a request\", () => {",
        "  const endpoint = new SimEndpoint(\"broken\");",
        "  openIt(endpoint);",
        "",
        "  // Backoff elapses; a caller asks, then decides not to call.",
        "  expect(endpoint.preflight(30_000)).toBe(true);",
        "  expect(endpoint.breaker.state).toBe(\"half-open\");",
        "",
        "  // Ten minutes later, a real request is still refused.",
        "  expect(endpoint.call(630_000, \"ok\")).toBe(\"refused\");",
        "  expect(endpoint.breaker.state).toBe(\"half-open\");",
        "  expect(endpoint.preflight(630_000)).toBe(false);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "Found by reading, not by failing",
      detail:
        "Nothing reported it. It surfaced while reading the call sites rather than the class: they do not all issue a request, and `canAttempt` mutates. The Broken state in the case reproduces the sequence in four button presses.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "fixed",
      title: "Split the query from the claim",
      detail:
        "`canAttempt()` becomes side-effect free and returns false while a probe is in flight; `beginAttempt()` reserves the slot at the one place a request is actually issued.",
      source: { kind: "simulation-logic", label: "lib/sims/circuit-breaker.ts", href: LOGIC },
    },
    {
      phase: "regression-test",
      title: "Test the endpoint, not the class",
      detail:
        "Eight cases drive both implementations through the app's own pre-flight-then-bail pattern, and assert that the old one never recovers. The class-level tests would have stayed green, which is the lesson.",
      source: { kind: "regression-test", label: "tests/unit/sims/circuit-breaker.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/circuit-breaker-half-open.ts",
      href: DEFINITION,
    },
    {
      kind: "simulation",
      label: "components/sims/breaker/breaker-sim.tsx",
      href: SIMULATION,
      note: "The state machine, the readouts and the virtual clock.",
    },
    {
      kind: "simulation-logic",
      label: "lib/sims/circuit-breaker.ts",
      href: LOGIC,
      note: "Both breakers, in one class with a version flag.",
    },
    {
      kind: "regression-test",
      label: "tests/unit/sims/circuit-breaker.test.ts",
      href: UNIT,
      note: "Eight cases, including the permanent-stranding one.",
    },
  ],

  evidence:
    "Both breakers are in the case and in `lib/sims/circuit-breaker.ts`, and the tests assert that the broken one stays stranded rather than only that the fixed one recovers.",
  simulationNote:
    "The breaker in the case is the same class the tests drive, on a virtual clock you advance by pressing a button. No network is involved; “fail a request” just records a failure.",
};
