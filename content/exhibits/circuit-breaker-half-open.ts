import type { Exhibit } from "../schema";

const REPO = "https://github.com/renrenmimi/ToneDown";
const COMMIT = `${REPO}/commit/ff02395627af644b5cb54f8affb49f3b8557233b`;
const BREAKER = `${REPO}/blob/main/src/shared/circuitBreaker.ts`;
const CLIENT = `${REPO}/blob/main/src/shared/llm/client.ts`;
const TEST = `${REPO}/blob/main/src/shared/llm/recovery.test.ts`;

export const circuitBreakerHalfOpen: Exhibit = {
  slug: "circuit-breaker-half-open",
  number: 2,
  title: "The circuit breaker that could never close again",
  summary:
    "Asking a circuit breaker whether a request was allowed consumed the one probe that would have let it recover.",
  project: {
    name: "ToneDown",
    repo: "renrenmimi/ToneDown",
    href: REPO,
    blurb:
      "A speaking-tone coach that calls several LLM endpoints while a session is live.",
  },
  categories: ["async", "testing", "state"],
  tech: ["TypeScript", "React", "Vitest", "Circuit breaker"],
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
    "ToneDown wraps each group of API endpoints in a three-state circuit breaker: closed, open after three consecutive failures, then half-open once a backoff has elapsed to let a single probe through. A successful probe closes the circuit; a failed one reopens it with a doubled backoff. It is a textbook design and it was implemented correctly.",
    "In the app, four call sites pre-flight with `canAttempt()` before deciding whether it is even worth assembling a request — analysis pacing, a too-short transcript, an already-answered budget check. Only some of them then go on to call.",
    "`canAttempt()` performed the open → half-open transition as a side effect of being asked. So a caller that asked and then bailed out left the breaker half-open with no probe in flight — and in half-open state `canAttempt()` returns false. Nothing was ever going to report back, so nothing was ever going to close the circuit. A caller that did proceed was rejected too, by `client.call()`'s own guard, because the pre-flight had already consumed the transition.",
    "Breakers are module-scoped, so analyze, rewrite, debrief and transcribe stayed dead until a full page reload. The degraded-mode fallback was designed to be temporary and had quietly become permanent.",
  ],

  rootCause: [
    "A query that mutates. `canAttempt()` reads like a question and behaves like a claim, so every caller who merely wondered whether a request was worth making silently took the last one.",
    "The two responsibilities are genuinely different: *may a request be issued right now* is a property of the breaker, and *I am issuing one, hold the slot for me* is a transaction. Merging them means the answer depends on who else has asked.",
    "The fix splits them. `canAttempt()` becomes a pure query — and explicitly returns false in half-open, because a probe is already in flight and it alone decides the next transition. `beginAttempt()` reserves the slot, and is called from exactly one place: the line in `client.call()` where a request really goes out.",
  ],

  excerpts: [
    {
      caption: "src/shared/circuitBreaker.ts — the question that answered itself",
      kind: "diff",
      language: "ts",
      verbatim: true,
      href: BREAKER,
      lines: [
        "   canAttempt(now: number = Date.now()): boolean {",
        "     if (this.currentState === 'closed') {",
        "       return true",
        "     }",
        "-    if (this.currentState === 'open' && now >= this.nextProbeAt) {",
        "-      this.currentState = 'half-open'",
        "-      return true",
        "+    if (this.currentState === 'half-open') {",
        "+      // A probe is already in flight; it alone decides what happens next.",
        "+      return false",
        "     }",
        "-    return false",
        "+    return now >= this.nextProbeAt",
        "   }",
      ],
    },
    {
      caption: "src/shared/circuitBreaker.ts — and the claim, made explicit",
      kind: "code",
      language: "ts",
      verbatim: true,
      href: BREAKER,
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
        "  if (this.currentState === 'open') {",
        "    this.currentState = 'half-open'",
        "  }",
        "  return true",
        "}",
      ],
    },
    {
      caption: "src/shared/llm/client.ts — one line, at the only honest place",
      kind: "diff",
      language: "ts",
      verbatim: true,
      href: CLIENT,
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
      "The `CircuitBreaker` class already had unit tests, and they passed the whole time. They called `canAttempt()` once per backoff window and then recorded a result — which is a reasonable way to test a state machine, and is not how the application used it.",
      "So the new test drives the real endpoint end to end instead of the class in isolation, with a stubbed `fetch` and fake timers. One case does what the app does: pre-flight, decide not to call, pre-flight again, and only then send a request. The other pre-flights five times, waits out ten more minutes, and asserts the endpoint still recovers.",
      "Both fail against the old implementation. That is the part worth insisting on — a regression test that has never been observed to fail is a screenshot with extra steps.",
    ],
    excerpt: {
      caption: "src/shared/llm/recovery.test.ts",
      kind: "code",
      language: "ts",
      verbatim: true,
      href: TEST,
      lines: [
        "it('a bailed-out pre-flight does not strand the endpoint', async () => {",
        "  const fetchMock = vi.fn().mockResolvedValue(failResponse())",
        "  vi.stubGlobal('fetch', fetchMock)",
        "  const endpoint = makeEndpoint()",
        "",
        "  for (let i = 0; i < 3; i += 1) {",
        "    await expect(endpoint.call({ n: i })).rejects.toThrow()",
        "  }",
        "",
        "  vi.advanceTimersByTime(30_000)",
        "  // Pre-flight repeatedly without ever calling — the failure mode.",
        "  for (let i = 0; i < 5; i += 1) {",
        "    endpoint.canAttempt()",
        "  }",
        "  vi.advanceTimersByTime(600_000)",
        "",
        "  fetchMock.mockResolvedValue(okResponse())",
        "  await expect(endpoint.call({ n: 1 })).resolves.toEqual({",
        "    value: 'good',",
        "  })",
        "  expect(getBreaker('analyze').state).toBe('closed')",
        "})",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "Found by reading, not by failing",
      detail:
        "Nothing reported it. It surfaced during a pass that read the files earlier reviews had only grepped — the breaker's four call sites do not all issue a request, and `canAttempt` mutates.",
      source: { kind: "commit", label: "ff02395", href: COMMIT },
    },
    {
      phase: "fixed",
      title: "Split the query from the claim",
      detail:
        "`canAttempt()` becomes side-effect free and returns false while a probe is in flight; `beginAttempt()` reserves the slot inside `client.call()`.",
      source: { kind: "file", label: "src/shared/circuitBreaker.ts", href: BREAKER },
    },
    {
      phase: "regression-test",
      title: "Test the endpoint, not the class",
      detail:
        "recovery.test.ts drives the real client with a stubbed fetch and fake timers, reproducing the app's pre-flight-then-bail pattern. The pre-existing unit tests stayed green throughout, which is the lesson.",
      source: { kind: "file", label: "src/shared/llm/recovery.test.ts", href: TEST },
    },
  ],

  sources: [
    {
      kind: "commit",
      label: "ff02395 — circuit breakers could never recover",
      href: COMMIT,
      note: "The commit message walks through both failure paths.",
    },
    { kind: "file", label: "src/shared/circuitBreaker.ts", href: BREAKER },
    { kind: "file", label: "src/shared/llm/client.ts", href: CLIENT },
    { kind: "file", label: "src/shared/llm/recovery.test.ts", href: TEST },
  ],

  evidence:
    "ToneDown commit ff02395 on main, which adds beginAttempt() and recovery.test.ts in the same change.",
  simulationNote:
    "The breaker in the case is a faithful re-implementation of both versions of ToneDown's `CircuitBreaker`, driven by a virtual clock you advance by pressing a button. No network is involved; “fail a request” just records a failure.",
};
