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

/* ------------------------------------------------------------
   Text that does not sit on a plain token: on a state colour's own
   tint, or drawn with opacity. These read the values the stylesheets
   actually set, so a change there is measured here.
   ------------------------------------------------------------ */

type RGB = [number, number, number];

const rgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** `colour` at `alpha` over `under`. */
const over = (colour: RGB, alpha: number, under: RGB): RGB => [
  colour[0] * alpha + under[0] * (1 - alpha),
  colour[1] * alpha + under[1] * (1 - alpha),
  colour[2] * alpha + under[2] * (1 - alpha),
];

/** One declaration from a CSS module, by selector and property. */
function declared(file: string, selector: string, property: string): string {
  const css = readFileSync(file, "utf8");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  const value = block?.match(new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`${selector} { ${property} } not found in ${file}`);
  return value.trim();
}

/** A colour that is either a hex literal or var(--token). */
const colourOf = (value: string): RGB =>
  rgb(value.startsWith("var(") ? token(value.slice(6, -1)) : value);

/* Both ends of the display case's gradient; light text is weakest on the lighter one. */
const CASE_ENDS = [rgb(token("case")), rgb(token("case-2"))];
const DIM = 0.14; // --broken-dim and friends
const BLACK: RGB = [0, 0, 0];

describe("text on tints and with opacity, as the stylesheets set it", () => {
  it("gallery chip counts stay readable, pressed or not", () => {
    const opacity = Number(declared("components/museum/gallery.module.css", ".count", "opacity"));
    const wall = rgb(token("wall"));
    const accent = rgb(token("accent"));
    const idle = contrast(toHex(over(rgb(token("ink-2")), opacity, wall)), token("wall"));
    const pressed = contrast(toHex(over(wall, opacity, accent)), token("accent"));
    expect(idle, `${idle.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    expect(pressed, `${pressed.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("an extra timer in the double-submit queue reads on its red tint", () => {
    const text = colourOf(declared("components/sims/blanks/blanks.module.css", ".slotExtra", "color"));
    for (const end of CASE_ENDS) {
      const ground = over(rgb(token("broken")), DIM, end);
      const ratio = contrast(toHex(text), toHex(ground));
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("a stranded breaker state reads on its red tint", () => {
    const text = colourOf(
      declared("components/sims/breaker/breaker.module.css", ".nodeStuck .nodeName", "color"),
    );
    for (const end of CASE_ENDS) {
      const ground = over(rgb(token("broken")), DIM, over(BLACK, 0.22, end));
      const ratio = contrast(toHex(text), toHex(ground));
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the answer box's border is visible against the case (3:1)", () => {
    const border = declared("components/sims/blanks/blanks.module.css", ".input", "border-color");
    const alpha = Number(border.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1]);
    for (const end of CASE_ENDS) {
      const edge = over(rgb(token("ink")), alpha, end);
      const ratio = contrast(toHex(edge), toHex(end));
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
});
