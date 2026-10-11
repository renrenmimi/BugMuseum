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

describe("what each entry point reports", () => {
  it("says an empty box was empty, not that it was blocked", () => {
    for (const version of ["broken", "fixed"] as const) {
      const { runner, pending } = setup(version);
      expect(runner.submit()).toBe("empty");
      expect(pending()).toBe(0);
    }
  });

  it("separates a wrong answer, a scheduled advance and a blocked one", () => {
    const { runner } = setup("fixed");
    runner.type("nonsense");
    expect(runner.submit()).toBe("wrong");

    answer(runner);
    expect(runner.submit()).toBe("scheduled");
    expect(runner.submit()).toBe("blocked");
    expect(runner.reveal()).toBe("blocked");
  });

  it("lets Reveal queue a second advance without the mutex", () => {
    const { runner, pending } = setup("broken");
    answer(runner);
    expect(runner.submit()).toBe("scheduled");
    expect(runner.reveal()).toBe("scheduled");
    expect(pending()).toBe(2);
  });
});

describe("past the last blank", () => {
  it("stops at the end however many advances were queued", () => {
    const { runner, flush } = setup("broken");
    answer(runner);
    for (let i = 0; i < 4; i += 1) runner.submit();
    flush();

    expect(runner.state().solved).toBe(BLANKS.length);
    expect(runner.state().skipped).toEqual([1, 2]);
  });

  it("does not report a skip when the last blank was answered", () => {
    const { runner, flush } = setup("broken");
    for (let i = 0; i < BLANKS.length - 1; i += 1) {
      answer(runner);
      runner.submit();
      flush();
    }
    answer(runner);
    for (let i = 0; i < 4; i += 1) runner.submit();
    flush();

    expect(runner.state().solved).toBe(BLANKS.length);
    expect(runner.state().skipped).toEqual([]);
  });
});

describe("a restart without the mutex", () => {
  it("cannot cancel what it never kept: every queued advance still fires", () => {
    const { runner, pending } = setup("broken");
    answer(runner);
    runner.submit();
    runner.submit();

    expect(runner.restart()).toEqual({ cancelled: 0, stillPending: 2 });
    expect(pending()).toBe(2);
    expect(runner.state().pending).toBe(2);
  });

  it("says which advances came from before the restart", () => {
    const { runner, flush } = setup("broken");
    const fired: { left: number | null; skipped: boolean; stale: boolean }[] = [];
    runner.onAdvance((info) => fired.push(info));
    answer(runner);
    runner.submit();
    runner.submit();
    runner.restart();
    flush();

    expect(fired).toEqual([
      { left: 0, skipped: true, stale: true },
      { left: 1, skipped: true, stale: true },
    ]);
    expect(runner.state().solved).toBe(2);
  });

  it("does not count a single Enter afterwards as a skip", () => {
    const { runner, flush } = setup("broken");
    answer(runner);
    runner.submit();
    runner.submit();
    runner.restart();
    flush();

    const skippedByStaleTimers = runner.state().skipped;
    answer(runner);
    runner.submit();
    flush();

    expect(runner.state().solved).toBe(BLANKS.length);
    expect(runner.state().skipped).toEqual(skippedByStaleTimers);
    expect(runner.state().seen).toContain(2);
  });

  it("leaves its timers running after unmount, but tells nobody", () => {
    const { runner, pending, flush } = setup("broken");
    let calls = 0;
    runner.onChange(() => {
      calls += 1;
    });
    answer(runner);
    runner.submit();
    runner.submit();
    calls = 0;
    runner.unmount();

    expect(pending()).toBe(2);
    flush();
    expect(calls).toBe(0);
  });
});

describe("a restart with the mutex", () => {
  it("cancels the one pending advance and says so", () => {
    const { runner, pending } = setup("fixed");
    answer(runner);
    runner.submit();

    expect(runner.restart()).toEqual({ cancelled: 1, stillPending: 0 });
    expect(pending()).toBe(0);
    expect(runner.state().pending).toBe(0);
  });
});
