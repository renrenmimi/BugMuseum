import { describe, expect, it } from "vitest";
import { exhibits, getExhibit, neighbours, usedCategories } from "@/content/exhibits";
import { SIMULATIONS, validateGallery } from "@/content/schema";
import { SIM_REGISTRY } from "@/components/sims/registry";

describe("the gallery as data", () => {
  it("passes every rule in validateGallery", () => {
    expect(validateGallery(exhibits)).toEqual([]);
  });

  it("ships between four and six exhibits", () => {
    expect(exhibits.length).toBeGreaterThanOrEqual(4);
    expect(exhibits.length).toBeLessThanOrEqual(6);
  });

  it("numbers the exhibits 1..n in gallery order", () => {
    expect(exhibits.map((e) => e.number)).toEqual(
      exhibits.map((_, i) => i + 1),
    );
  });

  it("registers a component for every simulation id in use", () => {
    for (const exhibit of exhibits) {
      expect(SIM_REGISTRY[exhibit.simulation]).toBeTypeOf("function");
    }
  });

  it("has no simulation ids without an exhibit", () => {
    const used = new Set(exhibits.map((e) => e.simulation));
    for (const id of SIMULATIONS) {
      expect(used.has(id), `${id} is declared but unused`).toBe(true);
    }
  });
});

describe("source links", () => {
  it("gives every exhibit at least one commit or pull request", () => {
    for (const exhibit of exhibits) {
      const proofs = exhibit.sources.filter(
        (s) => s.kind === "commit" || s.kind === "pull-request",
      );
      expect(proofs.length, exhibit.slug).toBeGreaterThan(0);
    }
  });

  it("points every link at one of my public repositories", () => {
    const allowed = ["DrillLab", "PetNote", "ToneDown", "AgentLab"];
    for (const exhibit of exhibits) {
      const hrefs = [
        exhibit.project.href,
        ...exhibit.sources.map((s) => s.href),
        ...exhibit.timeline.flatMap((t) => (t.source ? [t.source.href] : [])),
        ...exhibit.excerpts.flatMap((e) => (e.href ? [e.href] : [])),
      ];
      for (const href of hrefs) {
        expect(href, `${exhibit.slug}: ${href}`).toMatch(
          new RegExp(`^https://github\\.com/renrenmimi/(${allowed.join("|")})`),
        );
      }
    }
  });

  it("never uses http, and never links to a placeholder", () => {
    for (const exhibit of exhibits) {
      for (const source of exhibit.sources) {
        expect(source.href.startsWith("https://")).toBe(true);
        expect(source.href).not.toContain("example.com");
        expect(source.href).not.toContain("TODO");
      }
    }
  });

  it("links every quoted excerpt to the file or commit it came from", () => {
    for (const exhibit of exhibits) {
      const all = [...exhibit.excerpts, exhibit.test.excerpt];
      for (const excerpt of all) {
        if (excerpt.verbatim) {
          expect(excerpt.href, `${exhibit.slug}: ${excerpt.caption}`).toBeTruthy();
        }
      }
    }
  });
});

describe("the three states", () => {
  it("always offers broken and fixed, and first-fix only with an explanation", () => {
    for (const exhibit of exhibits) {
      const keys = exhibit.states.map((s) => s.key);
      expect(keys).toContain("broken");
      expect(keys).toContain("fixed");
      expect(keys.includes("first-fix")).toBe(
        Boolean(exhibit.whyFirstFixFailed?.length),
      );
    }
  });

  it("has at least one exhibit with a real first fix", () => {
    const withFirst = exhibits.filter((e) =>
      e.states.some((s) => s.key === "first-fix"),
    );
    expect(withFirst.length).toBeGreaterThan(0);
  });
});

describe("navigation between exhibits", () => {
  it("resolves a slug to an exhibit", () => {
    expect(getExhibit("drawer-scroll-lock")?.number).toBe(1);
    expect(getExhibit("nope")).toBeUndefined();
  });

  it("does not wrap at the ends of the gallery", () => {
    const first = exhibits[0];
    const last = exhibits[exhibits.length - 1];
    expect(first && neighbours(first.slug).previous).toBeUndefined();
    expect(last && neighbours(last.slug).next).toBeUndefined();
  });

  it("links each exhibit to the one after it", () => {
    for (let i = 0; i < exhibits.length - 1; i += 1) {
      const here = exhibits[i];
      const there = exhibits[i + 1];
      expect(here && neighbours(here.slug).next?.slug).toBe(there?.slug);
    }
  });
});

describe("filters", () => {
  it("only offers categories that at least one exhibit has", () => {
    for (const category of usedCategories()) {
      expect(exhibits.some((e) => e.categories.includes(category))).toBe(true);
    }
  });
});
