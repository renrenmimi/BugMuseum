import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BreakerSim } from "@/components/sims/breaker/breaker-sim";
import { RecogniserSim } from "@/components/sims/recogniser/recogniser-sim";
import { TabsSim } from "@/components/sims/tabs/tabs-sim";
import { TAB_SCRIPTS } from "@/lib/sims/two-tabs";

/** The value shown under a readout's name. */
const readout = (name: string) => {
  const key = screen.getByText(name, { selector: "span" });
  const value = key.nextElementSibling;
  if (!value) throw new Error(`no value for ${name}`);
  return value as HTMLElement;
};

describe("the circuit breaker's readouts agree with each other", () => {
  it("stops showing a denominator once failures run past the threshold", async () => {
    const user = userEvent.setup();
    render(<BreakerSim state="fixed" />);
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "Fail a request" }));
    }
    expect(readout("failures")).toHaveTextContent("3/3");

    await user.click(screen.getByRole("button", { name: "Wait 30s" }));
    await user.click(screen.getByRole("button", { name: "Fail a request" }));
    expect(readout("failures")).toHaveTextContent("4 in a row");
  });

  it("has no probe pending while closed, and none ever once stranded", async () => {
    const user = userEvent.setup();
    render(<BreakerSim state="broken" />);
    expect(readout("next probe")).toHaveTextContent("none");

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "Fail a request" }));
    }
    expect(readout("next probe")).toHaveTextContent("in 30s");
    await user.click(screen.getByRole("button", { name: "Wait 30s" }));
    await user.click(screen.getByRole("button", { name: "Pre-flight check" }));
    expect(readout("next probe")).toHaveTextContent("never");
  });

  it("does not paint the broken state's instructions in the fixed colour", async () => {
    const user = userEvent.setup();
    render(<BreakerSim state="broken" />);
    await user.click(screen.getByRole("button", { name: "Pre-flight check" }));
    expect(screen.getByTestId("breaker-verdict").className).not.toMatch(/verdictFixed/);
  });

  it("names the state diagram and marks the current state without colour", () => {
    render(<BreakerSim state="broken" />);
    const machine = screen.getByRole("group", { name: /circuit breaker states/i });
    const current = within(machine)
      .getAllByText(/^(closed|open|half-open)$/)
      .map((el) => el.parentElement)
      .filter((el) => el?.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("closed");
  });

  it("announces a change of verdict", () => {
    render(<BreakerSim state="broken" />);
    expect(screen.getByTestId("breaker-verdict")).toHaveAttribute("aria-live", "polite");
  });
});

describe("the recogniser reports what a listener would hear", () => {
  const step = async (user: ReturnType<typeof userEvent.setup>, n: number) => {
    const button = screen.getByRole("button", { name: "Step one tick" });
    for (let i = 0; i < n; i += 1) await user.click(button);
  };

  it("writes the transcript as one sentence, not a list of quotations", async () => {
    const user = userEvent.setup();
    render(<RecogniserSim state="fixed" />);
    await step(user, 16);
    const transcript = screen.getByTestId("transcript").textContent ?? "";
    expect(transcript).toContain("I think we should");
    expect(transcript).not.toContain('"');
  });

  it("does not mark the deliberate language bounce as a failure", async () => {
    const user = userEvent.setup();
    render(<RecogniserSim state="fixed" />);
    await user.click(screen.getByRole("button", { name: "Switch language at tick 6" }));
    await step(user, 16);
    expect(readout("onend")).toHaveTextContent("1");
    expect(readout("onend").className).not.toMatch(/valBroken/);
  });

  it("restarts the run when the language scenario changes, keeping its name", async () => {
    const user = userEvent.setup();
    render(<RecogniserSim state="fixed" />);
    await step(user, 10);
    expect(readout("clock")).toHaveTextContent("1800ms");

    const toggle = screen.getByRole("button", { name: "Switch language at tick 6" });
    await user.click(toggle);
    expect(readout("clock")).toHaveTextContent("0ms");
    expect(screen.getByRole("button", { name: "Switch language at tick 6" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hands focus to Reset when stepping reaches the end", async () => {
    const user = userEvent.setup();
    render(<RecogniserSim state="broken" />);
    screen.getByRole("button", { name: "Step one tick" }).focus();
    for (let i = 0; i < 16; i += 1) await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();
  });
});

describe("the two-tabs sequence keeps the keyboard in place", () => {
  it("moves focus to Reset at the last step and to Next at the first", async () => {
    const user = userEvent.setup();
    render(<TabsSim state="broken" />);

    const steps = TAB_SCRIPTS.broken.length - 1;

    screen.getByRole("button", { name: "Next step" }).focus();
    for (let i = 0; i < steps; i += 1) await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();

    screen.getByRole("button", { name: "Back" }).focus();
    for (let i = 0; i < steps; i += 1) await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Next step" })).toHaveFocus();
  });

  it("announces each step", () => {
    render(<TabsSim state="broken" />);
    expect(screen.getByTestId("tabs-frame")).toHaveAttribute("aria-live", "polite");
  });
});
