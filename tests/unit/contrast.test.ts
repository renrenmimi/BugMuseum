import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* ============================================================
   Contrast, measured rather than eyeballed. The tokens live in one
   file, so the numbers can be checked without a browser — and a
   colour that drifts under AA fails here rather than in review.
   ============================================================ */

const TOKENS = readFileSync("styles/tokens.css", "utf8");

function token(name: string): string {
  const match = TOKENS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!match?.[1]) throw new Error(`--${name} is not a plain hex token`);
  return match[1];
}

const channel = (c: number) =>
  c / 255 <= 0.03928
    ? c / 255 / 12.92
    : Math.pow((c / 255 + 0.055) / 1.055, 2.4);

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Every surface a piece of text can land on in this museum. */
const SURFACES = ["wall", "wall-2", "plinth", "case", "case-2"] as const;

/** Text colours, and the smallest size each is used at. */
const INKS = ["ink", "ink-2", "ink-3", "accent", "broken", "first", "fixed"] as const;

describe("text on every surface", () => {
  for (const ink of INKS) {
    for (const surface of SURFACES) {
      it(`--${ink} on --${surface} reaches AA`, () => {
        const ratio = contrast(token(ink), token(surface));
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  /* The code blocks have their own, darker background. */
  it("body ink reads on the code block background", () => {
    for (const ink of ["ink", "ink-2", "ink-3"] as const) {
      expect(contrast(token(ink), "#100e0b")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the primary button's label reads on its fill", () => {
    expect(contrast(token("wall"), token("accent"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the three weights stay distinguishable", () => {
  it("descends in luminance, ink → ink-2 → ink-3", () => {
    const [a, b, c] = [token("ink"), token("ink-2"), token("ink-3")].map(luminance);
    expect(a).toBeGreaterThan(b ?? 0);
    expect(b).toBeGreaterThan(c ?? 0);
  });
});
