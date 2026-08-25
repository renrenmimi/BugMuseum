import { describe, expect, it } from "vitest";
import {
  BLANKS,
  createBlankRunner,
  createManualClock,
} from "@/lib/sims/double-submit";

const setup = (version: "broken" | "fixed") => {
  const { clock, pending, flush } = createManualClock();
  const runner = createBlankRunner(version, clock, 700);
  return { runner, pending, flush };
};

const answer = (runner: ReturnType<typeof createBlankRunner>) => {
  const blank = runner.current();
  runner.type(blank?.display ?? "");
};

describe("without the mutex", () => {
  it("queues one timer per Enter", () => {
    const { runner, pending } = setup("broken");
    answer(runner);
    runner.submit();
    runner.submit();

    expect(pending()).toBe(2);
    expect(runner.state().advancesScheduled).toBe(2);
  });

  it("skips the blank between the two advances", () => {
    const { runner, pending, flush } = setup("broken");
    answer(runner);
    runner.submit();
    runner.submit();
    flush();

    expect(runner.state().solved).toBe(2);
    expect(runner.state().seen).not.toContain(1);
    expect(pending()).toBe(0);
  });

  it("means the visitor is never asked one of the three questions", () => {
    const { runner, flush } = setup("broken");
    answer(runner);
    runner.submit();
    runner.submit();
    flush();

    expect(runner.state().seen.length).toBeLessThan(BLANKS.length);
  });
});

describe("with the mutex", () => {
  it("ignores every submit inside the advance window", () => {
    const { runner, pending } = setup("fixed");
    answer(runner);
    runner.submit();
    runner.submit();
    runner.submit();

    expect(pending()).toBe(1);
    expect(runner.state().advancesScheduled).toBe(1);
  });

  it("advances exactly one blank", () => {
    const { runner, flush } = setup("fixed");
    answer(runner);
    runner.submit();
    runner.submit();
    flush();

    expect(runner.state().solved).toBe(1);
    expect(runner.state().seen).toEqual([0, 1]);
  });

  it("blocks Reveal during the window too", () => {
    const { runner, pending } = setup("fixed");
    answer(runner);
    runner.submit();
    runner.reveal();

    expect(pending()).toBe(1);
  });

  it("walks all three blanks when you wait between them", () => {
    const { runner, flush } = setup("fixed");
    for (let i = 0; i < BLANKS.length; i += 1) {
      answer(runner);
      runner.submit();
      flush();
    }

    expect(runner.state().solved).toBe(BLANKS.length);
    expect(runner.state().seen).toEqual([0, 1, 2]);
  });

  it("cancels a pending advance on restart", () => {
    const { runner, pending, flush } = setup("fixed");
    answer(runner);
    runner.submit();
    expect(pending()).toBe(1);

    runner.restart();
    expect(pending()).toBe(0);
    flush();
    expect(runner.state().solved).toBe(0);
  });

  it("does not fire an advance after unmount", () => {
    const { runner, pending, flush } = setup("fixed");
    answer(runner);
    runner.submit();
    runner.unmount();

    expect(pending()).toBe(0);
    flush();
    expect(runner.state().solved).toBe(0);
  });

  it("rejects a wrong answer without queueing anything", () => {
    const { runner, pending } = setup("fixed");
    runner.type("nonsense");
    runner.submit();

    expect(pending()).toBe(0);
    expect(runner.state().feedback.kind).toBe("wrong");
  });
});
