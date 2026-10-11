import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { exhibits } from "@/content/exhibits";
import { MUSEUM_REPO, type Exhibit } from "@/content/schema";
import { RichText } from "@/components/museum/rich-text";

/* ============================================================
   Guards for the promises the wall text makes about itself:
   an excerpt marked "from this repository" really is in the file
   it links to, no markup ever reaches the page as typed, and the
   prose keeps one quotation style.
   ============================================================ */

/** Fields rendered through RichText. */
function richFields(exhibit: Exhibit): [string, string][] {
  const out: [string, string][] = [
    ["evidence", exhibit.evidence],
    ["simulationNote", exhibit.simulationNote],
  ];
  exhibit.whatHappened.forEach((p, i) => out.push([`whatHappened[${i}]`, p]));
  exhibit.rootCause.forEach((p, i) => out.push([`rootCause[${i}]`, p]));
  (exhibit.whyFirstFixFailed ?? []).forEach((p, i) =>
    out.push([`whyFirstFixFailed[${i}]`, p]),
  );
  exhibit.test.intro.forEach((p, i) => out.push([`test.intro[${i}]`, p]));
  exhibit.timeline.forEach((t, i) => out.push([`timeline[${i}].detail`, t.detail]));
  exhibit.states.forEach((s) => {
    out.push([`states.${s.key}.headline`, s.headline]);
    s.tryThis.forEach((t, i) => out.push([`states.${s.key}.tryThis[${i}]`, t]));
  });
  return out;
}

/** Fields rendered as plain text, where any marker would show as typed. */
function plainFields(exhibit: Exhibit): [string, string][] {
  const out: [string, string][] = [
    ["title", exhibit.title],
    ["summary", exhibit.summary],
    ["context.label", exhibit.context.label],
    ["context.description", exhibit.context.description],
  ];
  exhibit.timeline.forEach((t, i) => out.push([`timeline[${i}].title`, t.title]));
  exhibit.sources.forEach((s, i) => {
    out.push([`sources[${i}].label`, s.label]);
    if (s.note) out.push([`sources[${i}].note`, s.note]);
  });
  for (const excerpt of [...exhibit.excerpts, exhibit.test.excerpt]) {
    out.push([`excerpt "${excerpt.caption}".caption`, excerpt.caption]);
  }
  return out;
}

describe("excerpts marked “from this repository”", () => {
  const quoted = exhibits.flatMap((exhibit) =>
    [...exhibit.excerpts, exhibit.test.excerpt]
      .filter((excerpt) => excerpt.origin === "museum-source")
      .map((excerpt) => ({ slug: exhibit.slug, excerpt })),
  );

  it("finds some to check", () => {
    expect(quoted.length).toBeGreaterThanOrEqual(exhibits.length);
  });

  it.each(quoted.map((q) => [`${q.slug}: ${q.excerpt.caption}`, q] as const))(
    "%s appears line by line, in order, in the file it links to",
    (_, { excerpt }) => {
      const path = (excerpt.href ?? "").replace(`${MUSEUM_REPO}/blob/main/`, "");
      const fileLines = readFileSync(path, "utf8")
        .split("\n")
        .map((line) => line.trim());
      const wanted = excerpt.lines
        .map((line) => (excerpt.kind === "diff" ? line.slice(1) : line).trim())
        .filter((line) => line.length > 0);

      let from = 0;
      for (const line of wanted) {
        const at = fileLines.indexOf(line, from);
        expect(at, `“${line}” is not in ${path} after line ${from}`).not.toBe(-1);
        from = at + 1;
      }
    },
  );
});

describe("exhibit prose on the page", () => {
  it("never shows a backtick or an asterisk as typed", () => {
    for (const exhibit of exhibits) {
      for (const [field, text] of richFields(exhibit)) {
        const { container, unmount } = render(createElement(RichText, { text }));
        expect(container.textContent, `${exhibit.slug}.${field}`).not.toMatch(/[`*]/);
        unmount();
      }
      for (const [field, text] of plainFields(exhibit)) {
        expect(text, `${exhibit.slug}.${field}`).not.toMatch(/[`*]/);
      }
    }
  });

  it("uses typographic quotes and apostrophes outside code", () => {
    for (const exhibit of exhibits) {
      for (const [field, text] of [...richFields(exhibit), ...plainFields(exhibit)]) {
        const prose = text.replace(/`[^`]*`/g, "");
        expect(prose, `${exhibit.slug}.${field}`).not.toMatch(/['"]/);
      }
    }
  });
});
