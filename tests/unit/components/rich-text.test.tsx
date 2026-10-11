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

  it("turns single asterisks into emphasis", () => {
    render(
      <p>
        <RichText text="what an effect *reacts to*, not what it *reads*" />
      </p>,
    );
    expect(screen.getByText("reacts to").tagName).toBe("EM");
    expect(screen.getByText("reads").tagName).toBe("EM");
  });

  it("never leaves an emphasis marker on screen", () => {
    const { container } = render(
      <p>
        <RichText text="`a`, **b** and *c d*, then *e*" />
      </p>,
    );
    expect(container.textContent).toBe("a, b and c d, then e");
  });

  it("leaves arithmetic and a lone asterisk alone", () => {
    const { container } = render(
      <p>
        <RichText text="2 * 3 is 6, and * on its own is just a star" />
      </p>,
    );
    expect(container.textContent).toBe("2 * 3 is 6, and * on its own is just a star");
    expect(container.querySelector("em")).toBeNull();
  });

  it("does not emphasise across a code span", () => {
    const { container } = render(
      <p>
        <RichText text="*see `x` here*" />
      </p>,
    );
    expect(container.querySelector("em")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe("x");
  });

  it("strips emphasis for plain contexts too", () => {
    expect(plainText("`a`, **b** and *c d*")).toBe("a, b and c d");
    expect(plainText("2 * 3")).toBe("2 * 3");
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
