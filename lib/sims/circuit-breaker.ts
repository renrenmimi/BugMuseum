/* ============================================================
   Both versions of the breaker, side by side, on a clock you pass
   in. The only difference between them is whether asking a
   question changes the answer.

   This is the object the exhibit drives and the object the unit
   tests drive — there is no third implementation anywhere.
   ============================================================ */

export type CircuitState = "closed" | "open" | "half-open";
export type BreakerVersion = "broken" | "fixed";

export interface BreakerOptions {
  failureThreshold?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export class SimBreaker {
  private failures = 0;
  private currentState: CircuitState = "closed";
  private backoffMs: number;
  private nextProbeAt = 0;

  readonly failureThreshold: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(
    private readonly version: BreakerVersion,
    {
      failureThreshold = 3,
      initialBackoffMs = 30_000,
      maxBackoffMs = 300_000,
    }: BreakerOptions = {},
  ) {
    this.failureThreshold = failureThreshold;
    this.initialBackoffMs = initialBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
    this.backoffMs = initialBackoffMs;
  }

  get state(): CircuitState {
    return this.currentState;
  }

  get consecutiveFailures(): number {
    return this.failures;
  }

  msUntilProbe(now: number): number {
    return this.currentState === "open"
      ? Math.max(0, this.nextProbeAt - now)
      : 0;
  }

  /**
   * The question. In the broken version it is also an answer: an elapsed open
   * circuit slides to half-open just because somebody wondered.
   */
  canAttempt(now: number): boolean {
    if (this.currentState === "closed") return true;

    if (this.version === "broken") {
      if (this.currentState === "open" && now >= this.nextProbeAt) {
        this.currentState = "half-open";
        return true;
      }
      return false;
    }

    if (this.currentState === "half-open") {
      // A probe is already in flight; it alone decides what happens next.
      return false;
    }
    return now >= this.nextProbeAt;
  }

  /**
   * The claim. Only the fixed version has one — in the broken version the
   * call site re-asked the question, which had already been spent.
   */
  beginAttempt(now: number): boolean {
    if (this.version === "broken") return this.canAttempt(now);
    if (!this.canAttempt(now)) return false;
    if (this.currentState === "open") this.currentState = "half-open";
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.backoffMs = this.initialBackoffMs;
    this.currentState = "closed";
  }

  recordFailure(now: number): void {
    this.failures += 1;
    if (this.currentState === "half-open") {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.open(now);
    } else if (
      this.currentState === "closed" &&
      this.failures >= this.failureThreshold
    ) {
      this.open(now);
    }
  }

  private open(now: number): void {
    this.currentState = "open";
    this.nextProbeAt = now + this.backoffMs;
  }
}

export type EndpointOutcome = "sent-ok" | "sent-failed" | "refused";

/**
 * Callers pre-flight before deciding whether it is even worth assembling a
 * request, and only some of them go on to issue one. This is that shape,
 * reduced to two methods.
 */
export class SimEndpoint {
  readonly breaker: SimBreaker;

  constructor(
    private readonly version: BreakerVersion,
    options?: BreakerOptions,
  ) {
    this.breaker = new SimBreaker(version, options);
  }

  /** "Is it even worth building a request right now?" */
  preflight(now: number): boolean {
    return this.breaker.canAttempt(now);
  }

  /** The line where a request really goes out. */
  call(now: number, upstream: "ok" | "fail"): EndpointOutcome {
    const allowed =
      this.version === "broken"
        ? this.breaker.canAttempt(now)
        : this.breaker.beginAttempt(now);

    if (!allowed) return "refused";

    if (upstream === "ok") {
      this.breaker.recordSuccess();
      return "sent-ok";
    }
    this.breaker.recordFailure(now);
    return "sent-failed";
  }
}
