import { describe, expect, it } from "vitest";
import { countOf, runRecogniser } from "@/lib/sims/restart-loop";

describe("the effect that lists the state it produces", () => {
  it("ping-pongs between start and end", () => {
    const run = runRecogniser("broken", { ticks: 12 });

    expect(run.starts).toBeGreaterThan(4);
    expect(run.ends).toBeGreaterThan(4);
    expect(countOf(run.events, "stop")).toBeGreaterThan(4);
  });

  it("never keeps the engine up long enough to commit a word", () => {
    const run = runRecogniser("broken", { ticks: 16 });

    expect(run.transcript).toBe("");
    expect(countOf(run.events, "result")).toBe(0);
    expect(countOf(run.events, "partial")).toBeGreaterThan(0);
  });

  it("stops itself on the very first start", () => {
    const run = runRecogniser("broken", { ticks: 1 });
    const kinds = run.events.map((e) => e.kind);

    expect(kinds.slice(0, 4)).toEqual(["user", "start", "effect", "stop"]);
  });
});

describe("the effect that keys on the language alone", () => {
  it("starts once and stays running", () => {
    const run = runRecogniser("fixed", { ticks: 12 });

    expect(run.starts).toBe(1);
    expect(run.ends).toBe(0);
    expect(countOf(run.events, "stop")).toBe(0);
  });

  it("transcribes whole words", () => {
    const run = runRecogniser("fixed", { ticks: 12 });

    expect(run.transcript.startsWith("I think we should")).toBe(true);
    expect(countOf(run.events, "result")).toBeGreaterThan(3);
  });

  it("still bounces the engine exactly once for a real language change", () => {
    const run = runRecogniser("fixed", { ticks: 14, switchAt: 6 });

    expect(run.starts).toBe(2);
    expect(countOf(run.events, "stop")).toBe(1);
    const stop = run.events.find((e) => e.kind === "stop");
    expect(stop?.text).toContain("deliberate");
  });

  it("keeps transcribing after the language change", () => {
    const withSwitch = runRecogniser("fixed", { ticks: 16, switchAt: 6 });
    expect(withSwitch.transcript.split(" ").length).toBeGreaterThan(2);
  });
});

describe("the two versions, compared", () => {
  it("differ by an order of magnitude in engine restarts", () => {
    const broken = runRecogniser("broken", { ticks: 16 });
    const fixed = runRecogniser("fixed", { ticks: 16 });

    expect(broken.starts).toBeGreaterThan(fixed.starts * 4);
  });
});
