import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExhibitStage } from "@/components/museum/exhibit-stage";
import { getExhibit } from "@/content/exhibits";

const drawer = getExhibit("drawer-scroll-lock")!;
const breaker = getExhibit("circuit-breaker-half-open")!;

describe("the state selector", () => {
  it("offers one radio per state and starts on Broken", () => {
    render(<ExhibitStage exhibit={drawer} syncHash={false} />);
    const group = screen.getByRole("radiogroup");
    const options = within(group).getAllByRole("radio");

    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-checked", "true");
    expect(options[0]).toHaveTextContent("Broken");
  });

  it("swaps the wall label when a state is chosen", async () => {
    const user = userEvent.setup();
    render(<ExhibitStage exhibit={drawer} syncHash={false} />);

    expect(screen.getByTestId("state-headline")).toHaveTextContent(
      "The scrim stops clicks, not scrolling",
    );

    await user.click(screen.getByRole("radio", { name: /first fix/i }));
    expect(screen.getByTestId("state-headline")).toHaveTextContent(
      "closing takes a slow ride back",
    );

    await user.click(screen.getByRole("radio", { name: /^fixed$/i }));
    expect(screen.getByTestId("state-headline")).toHaveTextContent(
      "comes back on the very next frame",
    );
  });

  it("keeps exactly one option checked", async () => {
    const user = userEvent.setup();
    render(<ExhibitStage exhibit={drawer} syncHash={false} />);
    await user.click(screen.getByRole("radio", { name: /first fix/i }));

    const checked = screen
      .getAllByRole("radio")
      .filter((el) => el.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });

  it("moves between states with the arrow keys, and wraps", async () => {
    const user = userEvent.setup();
    render(<ExhibitStage exhibit={drawer} syncHash={false} />);

    screen.getAllByRole("radio")[0]!.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /first fix/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /^fixed$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /^broken$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: /^fixed$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("uses roving tabindex so the group is one tab stop", async () => {
    const user = userEvent.setup();
    render(<ExhibitStage exhibit={drawer} syncHash={false} />);
    const options = screen.getAllByRole("radio");

    expect(options.filter((o) => o.tabIndex === 0)).toHaveLength(1);
    await user.click(options[2]!);
    expect(options.filter((o) => o.tabIndex === 0)).toHaveLength(1);
    expect(options[2]).toHaveAttribute("tabindex", "0");
  });

  it("shows only two options for an exhibit without a first fix", () => {
    render(<ExhibitStage exhibit={breaker} syncHash={false} />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("always shows the simulation note under the case", () => {
    render(<ExhibitStage exhibit={breaker} syncHash={false} />);
    expect(
      screen.getByText(/the same class the tests drive/i),
    ).toBeInTheDocument();
  });

  it("labels the case with the technical setting, not a project", () => {
    render(<ExhibitStage exhibit={breaker} syncHash={false} />);
    expect(screen.getByText(breaker.context.label)).toBeInTheDocument();
  });
});

describe("the case label", () => {
  it("carries the exhibit number and the selected state", async () => {
    const user = userEvent.setup();
    render(<ExhibitStage exhibit={drawer} syncHash={false} />);

    expect(screen.getByText(/Exhibit 01 — Broken/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^fixed$/i }));
    expect(screen.getByText(/Exhibit 01 — Fixed/)).toBeInTheDocument();
  });
});
