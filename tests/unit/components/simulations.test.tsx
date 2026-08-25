import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BreakerSim } from "@/components/sims/breaker/breaker-sim";
import { DaySim } from "@/components/sims/day/day-sim";
import { RecogniserSim } from "@/components/sims/recogniser/recogniser-sim";
import { TabsSim } from "@/components/sims/tabs/tabs-sim";
import { BlanksSim } from "@/components/sims/blanks/blanks-sim";

describe("the circuit breaker case", () => {
  it("strands itself after a pre-flight in the broken state", async () => {
    const user = userEvent.setup();
    render(<BreakerSim state="broken" />);

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "Fail a request" }));
    }
    await user.click(screen.getByRole("button", { name: "Wait 30s" }));
    await user.click(screen.getByRole("button", { name: "Pre-flight check" }));

    expect(screen.getByTestId("breaker-verdict")).toHaveTextContent(
      /Half-open with no probe in flight/,
    );

    await user.click(screen.getByRole("button", { name: "Send a request" }));
    expect(screen.getByTestId("breaker-verdict")).toHaveTextContent(
      /Half-open with no probe in flight/,
    );
  });

  it("recovers after the same sequence in the fixed state", async () => {
    const user = userEvent.setup();
    render(<BreakerSim state="fixed" />);

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "Fail a request" }));
    }
    await user.click(screen.getByRole("button", { name: "Wait 30s" }));
    await user.click(screen.getByRole("button", { name: "Pre-flight check" }));
    await user.click(screen.getByRole("button", { name: "Send a request" }));

    expect(screen.getByTestId("breaker-verdict")).toHaveTextContent(
      /Asking is free/,
    );
  });
});

describe("the day-boundary case", () => {
  it("skips 8 March when it walks in milliseconds", () => {
    render(<DaySim state="broken" />);
    expect(screen.getByTestId("walk-verdict")).toHaveTextContent(
      /never looked at 2026-03-08/,
    );
  });

  it("visits every date once when it steps the calendar", () => {
    render(<DaySim state="first-fix" />);
    expect(screen.getByTestId("walk-verdict")).toHaveTextContent(
      /visited exactly once/,
    );
  });

  it("still rotates the drill mid-afternoon in the first fix", () => {
    render(<DaySim state="first-fix" />);
    expect(screen.getByTestId("drill-verdict")).toHaveTextContent(
      /mid-afternoon/,
    );
  });

  it("rotates at local midnight once fixed", () => {
    render(<DaySim state="fixed" />);
    expect(screen.getByTestId("drill-verdict")).toHaveTextContent(
      /local midnight/,
    );
  });

  it("counts the fall-back day twice in the broken walk", async () => {
    const user = userEvent.setup();
    render(<DaySim state="broken" />);

    await user.click(screen.getByRole("button", { name: "Fall back" }));
    expect(screen.getByTestId("walk-verdict")).toHaveTextContent(
      /landed on 2026-11-01 twice/,
    );
  });
});

describe("the recogniser case", () => {
  it("shows the dependency array that caused it", () => {
    render(<RecogniserSim state="broken" />);
    expect(screen.getByTestId("deps")).toHaveTextContent("[isRecognizing, language]");
  });

  it("keeps the transcript empty while it ping-pongs", async () => {
    const user = userEvent.setup();
    render(<RecogniserSim state="broken" />);

    const step = screen.getByRole("button", { name: "Step one tick" });
    for (let i = 0; i < 8; i += 1) await user.click(step);

    expect(screen.getByTestId("transcript")).toHaveTextContent(/discarded/);
  });

  it("transcribes whole words once the effect keys on language", async () => {
    const user = userEvent.setup();
    render(<RecogniserSim state="fixed" />);

    const step = screen.getByRole("button", { name: "Step one tick" });
    for (let i = 0; i < 8; i += 1) await user.click(step);

    expect(screen.getByTestId("transcript")).toHaveTextContent("I think");
  });
});

describe("the two-tabs case", () => {
  it("walks to a resurrected account in the broken state", async () => {
    const user = userEvent.setup();
    render(<TabsSim state="broken" />);

    const next = screen.getByRole("button", { name: "Next step" });
    while (!next.hasAttribute("disabled")) {
      await user.click(next);
    }
    expect(screen.getByText("recreated ⚠")).toBeInTheDocument();
  });

  it("ends signed out with nothing cached in the fixed state", async () => {
    const user = userEvent.setup();
    render(<TabsSim state="fixed" />);

    const next = screen.getByRole("button", { name: "Next step" });
    while (!next.hasAttribute("disabled")) {
      await user.click(next);
    }
    expect(screen.getAllByText("0/3").length).toBeGreaterThan(0);
    expect(screen.queryByText("recreated ⚠")).not.toBeInTheDocument();
  });
});

describe("the fill-in-the-blank case", () => {
  it("skips a blank when Enter is pressed twice", async () => {
    const user = userEvent.setup();
    render(<BlanksSim state="broken" />);

    await user.click(screen.getByRole("button", { name: "Fill the answer" }));
    await user.click(screen.getByTestId("double-enter"));

    expect(screen.getByTestId("timer-queue")).toHaveTextContent(/advance/);
    // The blank between the two advances is marked skipped in the code card.
    await screen.findByText("skipped", {}, { timeout: 3000 });
    expect(screen.getByTestId("blank-prompt")).toHaveTextContent("Blank 3 of 3");
  });

  it("ignores the second Enter when fixed", async () => {
    const user = userEvent.setup();
    render(<BlanksSim state="fixed" />);

    await user.click(screen.getByRole("button", { name: "Fill the answer" }));
    await user.click(screen.getByTestId("double-enter"));

    await screen.findByText(/Blank 2 of 3/, {}, { timeout: 3000 });
    expect(screen.queryByText("skipped")).not.toBeInTheDocument();
  });
});
