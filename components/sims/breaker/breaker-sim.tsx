"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import type { CircuitState } from "@/lib/sims/circuit-breaker";
import { SimEndpoint } from "@/lib/sims/circuit-breaker";
import { EventLog } from "../event-log";
import { Readout } from "../readout";
import { useEventLog } from "../use-event-log";
import sim from "../sim.module.css";
import s from "./breaker.module.css";

const STATES: { key: CircuitState; what: string }[] = [
  { key: "closed", what: "Requests go through." },
  { key: "open", what: "Everything is skipped until the backoff elapses." },
  { key: "half-open", what: "Exactly one probe is allowed, and it decides." },
];

const clock = (ms: number) => `${(ms / 1000).toFixed(0)}s`;

export function BreakerSim({ state }: { state: StateKey }) {
  const version = state === "fixed" ? "fixed" : "broken";
  const endpointRef = useRef(new SimEndpoint(version));
  const [now, setNow] = useState(0);
  const [, forceRender] = useState(0);
  const [preflights, setPreflights] = useState(0);
  const { entries, push, clear } = useEventLog(40);

  const tone = version === "fixed" ? "fixed" : "broken";

  const reset = useCallback(() => {
    endpointRef.current = new SimEndpoint(version);
    setNow(0);
    setPreflights(0);
    clear();
    forceRender((n) => n + 1);
  }, [version, clear]);

  useEffect(() => {
    reset();
  }, [reset]);

  const endpoint = endpointRef.current;
  const breaker = endpoint.breaker;
  const circuit = breaker.state;

  const failOnce = () => {
    const before = breaker.state;
    const outcome = endpoint.call(now, "fail");
    push(
      clock(now),
      outcome === "refused"
        ? "call() refused — the breaker would not admit it"
        : `call() failed upstream (${breaker.consecutiveFailures}/3)`,
      outcome === "refused" ? tone : "neutral",
    );
    if (before !== breaker.state) {
      push(clock(now), `circuit ${before} → ${breaker.state}`, tone);
    }
    forceRender((n) => n + 1);
  };

  const succeedOnce = () => {
    const before = breaker.state;
    const outcome = endpoint.call(now, "ok");
    push(
      clock(now),
      outcome === "refused"
        ? "call() refused — no slot available"
        : "call() succeeded upstream",
      outcome === "refused" ? tone : "fixed",
    );
    if (before !== breaker.state) {
      push(clock(now), `circuit ${before} → ${breaker.state}`, "fixed");
    }
    forceRender((n) => n + 1);
  };

  const preflight = () => {
    const before = breaker.state;
    const allowed = endpoint.preflight(now);
    setPreflights((n) => n + 1);
    push(
      clock(now),
      `canAttempt() → ${allowed}`,
      before !== breaker.state ? "broken" : "neutral",
    );
    if (before !== breaker.state) {
      push(
        clock(now),
        `…and the question moved the circuit ${before} → ${breaker.state}`,
        "broken",
      );
    }
    forceRender((n) => n + 1);
  };

  const advance = (ms: number) => {
    const next = now + ms;
    setNow(next);
    push(clock(next), `waited ${ms / 1000}s`, "neutral");
  };

  const stuck =
    circuit === "half-open" && !breaker.canAttempt(now) && version === "broken";

  const nodeClass = (key: CircuitState) => {
    if (key !== circuit) return cx(s.node);
    if (stuck) return cx(s.node, s.nodeStuck);
    if (key === "closed") return cx(s.node, s.nodeHealthy);
    return cx(s.node, s.nodeOn);
  };

  return (
    <div className={sim.sim}>
      <div className={s.machine} aria-label="Circuit breaker state">
        {STATES.map((node) => (
          <div key={node.key} className={nodeClass(node.key)}>
            <span className={s.nodeName}>{node.key}</span>
            <span className={s.nodeWhat}>{node.what}</span>
          </div>
        ))}
      </div>

      <div className={sim.readouts}>
        <Readout name="clock" value={clock(now)} />
        <Readout
          name="circuit"
          value={circuit}
          tone={stuck ? "broken" : circuit === "closed" ? "fixed" : "neutral"}
        />
        <Readout name="failures" value={`${breaker.consecutiveFailures}/3`} />
        <Readout
          name="next probe"
          value={
            breaker.msUntilProbe(now) > 0
              ? `in ${clock(breaker.msUntilProbe(now))}`
              : "now"
          }
        />
        <Readout name="pre-flights" value={preflights} />
      </div>

      <p
        className={cx(
          s.verdict,
          stuck && s.verdictBroken,
          circuit === "closed" && preflights > 0 && s.verdictFixed,
        )}
        data-testid="breaker-verdict"
      >
        {stuck
          ? "Half-open with no probe in flight. canAttempt() now returns false, and nothing will ever report back to change that — this endpoint is dead until the page reloads."
          : version === "fixed"
            ? "Asking is free. The probe slot is only reserved when a request is actually issued."
            : "Fail three calls, wait out the backoff, then press “Pre-flight check” before sending anything."}
      </p>

      <div className={sim.controls}>
        <button type="button" className={sim.btn} onClick={failOnce}>
          Fail a request
        </button>
        <button type="button" className={sim.btn} onClick={() => advance(30_000)}>
          Wait 30s
        </button>
        <button type="button" className={cx(sim.btn, sim.btnPrimary)} onClick={preflight}>
          Pre-flight check
        </button>
        <button type="button" className={sim.btn} onClick={succeedOnce}>
          Send a request
        </button>
        <button type="button" className={sim.btn} onClick={reset}>
          Reset
        </button>
      </div>

      <EventLog entries={entries} label="Circuit breaker event log" />
    </div>
  );
}
