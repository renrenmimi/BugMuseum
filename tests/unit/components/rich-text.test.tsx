import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichText, plainText } from "@/components/museum/rich-text";
import { exhibits } from "@/content/exhibits";

describe("RichText", () => {
  it("turns backticked spans into inline code", () => {
    render(
      <p>
        <RichText text="It obeys the CSS `scroll-behavior` of the element." />
      </p>,
    );
    const code = screen.getByText("scroll-behavior");
    expect(code.tagName).toBe("CODE");
  });

  it("turns double asterisks into emphasis", () => {
    render(
      <p>
        <RichText text="put the **previous inline value** back" />
      </p>,
    );
    expect(screen.getByText("previous inline value").tagName).toBe("STRONG");
  });

  it("leaves plain text alone", () => {
    render(
      <p>
        <RichText text="Nothing to see here." />
      </p>,
    );
    expect(screen.getByText("Nothing to see here.")).toBeInTheDocument();
  });

  it("never leaves a marker on screen", () => {
    const { container } = render(
      <p>
        <RichText text="`a` and **b** and `c`" />
      </p>,
    );
    expect(container.textContent).toBe("a and b and c");
  });

  it("does not choke on a lone backtick", () => {
    const { container } = render(
      <p>
        <RichText text="a ` lonely tick" />
      </p>,
    );
    expect(container.textContent).toBe("a ` lonely tick");
  });

  it("strips markers for plain contexts", () => {
    expect(plainText("`a` and **b**")).toBe("a and b");
  });
});

describe("exhibit prose", () => {
  it("keeps titles and summaries free of markup", () => {
    for (const exhibit of exhibits) {
      expect(exhibit.title, exhibit.slug).not.toMatch(/[`]|\*\*/);
      expect(exhibit.summary, exhibit.slug).not.toMatch(/[`]|\*\*/);
    }
  });

  it("never leaves an unbalanced backtick in a rendered paragraph", () => {
    for (const exhibit of exhibits) {
      const paragraphs = [
        ...exhibit.whatHappened,
        ...exhibit.rootCause,
        ...(exhibit.whyFirstFixFailed ?? []),
        ...exhibit.test.intro,
        ...exhibit.timeline.map((t) => t.detail),
        ...exhibit.states.flatMap((s) => [s.headline, ...s.tryThis]),
        exhibit.simulationNote,
        exhibit.evidence,
      ];
      for (const para of paragraphs) {
        const ticks = (para.match(/`/g) ?? []).length;
        expect(ticks % 2, `${exhibit.slug}: ${para.slice(0, 50)}`).toBe(0);
      }
    }
  });
});
