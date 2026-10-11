import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DaySim } from "@/components/sims/day/day-sim";
import { EventLog } from "@/components/sims/event-log";
import { Gallery } from "@/components/museum/gallery";
import { exhibits, usedCategories } from "@/content/exhibits";

describe("what assistive technology is told", () => {
  it("the day slider speaks a time and a date, not a bare number", () => {
    render(<DaySim state="broken" />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", "00:30 local time, 2026-03-10");
  });

  it("the day verdicts are announced when they change", () => {
    render(<DaySim state="broken" />);
    expect(screen.getByTestId("walk-verdict")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("drill-verdict")).toHaveAttribute("aria-live", "polite");
  });

  it("an event log is a log region, so new lines are announced", () => {
    render(<EventLog entries={[]} label="Test event log" />);
    expect(screen.getByRole("log")).toBeInTheDocument();
  });

  it("the gallery filters are one named group", () => {
    render(<Gallery exhibits={exhibits} categories={usedCategories()} />);
    const group = screen.getByRole("group", { name: "Filter" });
    expect(within(group).getByRole("button", { name: /^All/ })).toBeInTheDocument();
  });

  it("each card says how many states its exhibit has", () => {
    render(<Gallery exhibits={exhibits} categories={usedCategories()} />);
    expect(screen.getAllByRole("img", { name: /^\d states: Broken/ })).toHaveLength(
      exhibits.length,
    );
  });
});
