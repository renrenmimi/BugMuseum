import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gallery } from "@/components/museum/gallery";
import { exhibits, usedCategories } from "@/content/exhibits";

const renderGallery = () =>
  render(<Gallery exhibits={exhibits} categories={usedCategories()} />);

describe("the gallery filters", () => {
  it("renders every exhibit before anything is filtered", () => {
    renderGallery();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(
      exhibits.length,
    );
    for (const exhibit of exhibits) {
      expect(
        screen.getByRole("link", { name: exhibit.title }),
      ).toBeInTheDocument();
    }
  });

  it("starts with All pressed", () => {
    renderGallery();
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("narrows the gallery to one category", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByRole("button", { name: /^Browser/ }));

    const inBrowser = exhibits.filter((e) => e.categories.includes("browser"));
    for (const exhibit of inBrowser) {
      expect(
        screen.getByRole("link", { name: exhibit.title }),
      ).toBeInTheDocument();
    }
    for (const exhibit of exhibits.filter(
      (e) => !e.categories.includes("browser"),
    )) {
      expect(
        screen.queryByRole("link", { name: exhibit.title }),
      ).not.toBeInTheDocument();
    }
  });

  it("announces the count", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.click(screen.getByRole("button", { name: /^Testing/ }));
    const testingCount = exhibits.filter((e) =>
      e.categories.includes("testing"),
    ).length;
    expect(screen.getByRole("status")).toHaveTextContent(
      `Showing ${testingCount} of ${exhibits.length} exhibits in Testing`,
    );
  });

  it("clears the filter when the active chip is pressed again", async () => {
    const user = userEvent.setup();
    renderGallery();

    const chip = screen.getByRole("button", { name: /^Concurrency/ });
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      `Showing ${exhibits.length} of ${exhibits.length}`,
    );
  });

  it("is reachable entirely from the keyboard", async () => {
    const user = userEvent.setup();
    renderGallery();

    await user.tab();
    expect(screen.getByRole("button", { name: /^All/ })).toHaveFocus();

    await user.tab();
    await user.keyboard("{Enter}");
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });

  it("links each card to its own URL", () => {
    renderGallery();
    for (const exhibit of exhibits) {
      expect(
        screen.getByRole("link", { name: exhibit.title }),
      ).toHaveAttribute("href", `/exhibits/${exhibit.slug}`);
    }
  });
});
