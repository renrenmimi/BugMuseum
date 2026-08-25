import { describe, expect, it } from "vitest";
import { SimEndpoint } from "@/lib/sims/circuit-breaker";

const openIt = (endpoint: SimEndpoint, at = 0) => {
  for (let i = 0; i < 3; i += 1) endpoint.call(at, "fail");
};

describe("the broken breaker", () => {
  it("opens after three consecutive failures", () => {
    const endpoint = new SimEndpoint("broken");
    openIt(endpoint);
    expect(endpoint.breaker.state).toBe("open");
    expect(endpoint.preflight(0)).toBe(false);
  });

  it("is stranded by a pre-flight that never becomes a request", () => {
    const endpoint = new SimEndpoint("broken");
    openIt(endpoint);

    // Backoff elapses; a caller asks, then decides not to call.
    expect(endpoint.preflight(30_000)).toBe(true);
    expect(endpoint.breaker.state).toBe("half-open");

    // Ten minutes later, a real request is still refused.
    expect(endpoint.call(630_000, "ok")).toBe("refused");
    expect(endpoint.breaker.state).toBe("half-open");
    expect(endpoint.preflight(630_000)).toBe(false);
  });

  it("also refuses the caller that did go on to send", () => {
    const endpoint = new SimEndpoint("broken");
    openIt(endpoint);

    // The pre-flight consumes the transition...
    expect(endpoint.preflight(30_000)).toBe(true);
    // ...so call()'s own guard finds nothing left.
    expect(endpoint.call(30_000, "ok")).toBe("refused");
  });
});

describe("the fixed breaker", () => {
  it("opens the same way", () => {
    const endpoint = new SimEndpoint("fixed");
    openIt(endpoint);
    expect(endpoint.breaker.state).toBe("open");
  });

  it("survives five pre-flights and ten idle minutes", () => {
    const endpoint = new SimEndpoint("fixed");
    openIt(endpoint);

    for (let i = 0; i < 5; i += 1) {
      expect(endpoint.preflight(30_000)).toBe(true);
    }
    expect(endpoint.breaker.state).toBe("open");

    expect(endpoint.call(630_000, "ok")).toBe("sent-ok");
    expect(endpoint.breaker.state).toBe("closed");
  });

  it("keeps canAttempt side-effect free", () => {
    const endpoint = new SimEndpoint("fixed");
    openIt(endpoint);
    const before = endpoint.breaker.state;
    endpoint.preflight(30_000);
    endpoint.preflight(30_000);
    expect(endpoint.breaker.state).toBe(before);
  });

  it("refuses a second concurrent probe while one is in flight", () => {
    const endpoint = new SimEndpoint("fixed");
    openIt(endpoint);
    expect(endpoint.breaker.beginAttempt(30_000)).toBe(true);
    expect(endpoint.breaker.state).toBe("half-open");
    expect(endpoint.breaker.canAttempt(30_000)).toBe(false);
    expect(endpoint.breaker.beginAttempt(30_000)).toBe(false);
  });

  it("doubles the backoff when the probe fails, rather than sticking", () => {
    const endpoint = new SimEndpoint("fixed");
    openIt(endpoint);
    expect(endpoint.call(30_000, "fail")).toBe("sent-failed");
    expect(endpoint.breaker.state).toBe("open");
    expect(endpoint.breaker.msUntilProbe(30_000)).toBe(60_000);
    expect(endpoint.call(90_000, "ok")).toBe("sent-ok");
    expect(endpoint.breaker.state).toBe("closed");
  });
});
