import { describe, expect, it } from "vitest";
import { exhibits, getExhibit, neighbours, usedCategories } from "@/content/exhibits";
import {
  CONTEXT_LABELS,
  MUSEUM_REPO,
  SIMULATIONS,
  isAllowedHref,
  validateGallery,
} from "@/content/schema";
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
  it("gives every exhibit its definition, its simulation and its test", () => {
    for (const exhibit of exhibits) {
      const kinds = new Set(exhibit.sources.map((s) => s.kind));
      expect(kinds.has("exhibit-definition"), exhibit.slug).toBe(true);
      expect(kinds.has("simulation"), exhibit.slug).toBe(true);
      expect(kinds.has("regression-test"), exhibit.slug).toBe(true);
    }
  });

  it("only links inside this project", () => {
    for (const exhibit of exhibits) {
      const hrefs = [
        ...exhibit.sources.map((s) => s.href),
        ...exhibit.timeline.flatMap((t) => (t.source ? [t.source.href] : [])),
        ...exhibit.excerpts.flatMap((e) => (e.href ? [e.href] : [])),
        ...(exhibit.test.excerpt.href ? [exhibit.test.excerpt.href] : []),
      ];
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(isAllowedHref(href), `${exhibit.slug}: ${href}`).toBe(true);
      }
    }
  });

  it("rejects a link to a different repository under the same owner", () => {
    /* Built from MUSEUM_REPO rather than written out, so this file does not
       itself contain a link to another repository under the same owner. */
    const sameOwnerOtherRepo = MUSEUM_REPO.replace(/BugMuseum$/, "SomeOtherRepo");
    const otherOwner = MUSEUM_REPO.replace("/renrenmimi/", "/someone-else/");

    expect(isAllowedHref(`${MUSEUM_REPO}/blob/main/lib/sims/local-day.ts`)).toBe(
      true,
    );
    expect(isAllowedHref("/exhibits/local-day-boundary")).toBe(true);
    expect(isAllowedHref(sameOwnerOtherRepo)).toBe(false);
    expect(isAllowedHref(otherOwner)).toBe(false);
    expect(isAllowedHref(MUSEUM_REPO.replace("https:", "http:"))).toBe(false);
    expect(isAllowedHref("https://example.com/")).toBe(false);
  });

  it("links every excerpt that claims to be quoted from here", () => {
    for (const exhibit of exhibits) {
      const all = [...exhibit.excerpts, exhibit.test.excerpt];
      for (const excerpt of all) {
        if (excerpt.origin === "museum-source") {
          expect(excerpt.href, `${exhibit.slug}: ${excerpt.caption}`).toBeTruthy();
        }
      }
    }
  });

  it("shows every regression test from this repository rather than illustrating one", () => {
    for (const exhibit of exhibits) {
      expect(exhibit.test.excerpt.origin, exhibit.slug).toBe("museum-source");
    }
  });
});

describe("the exhibit context", () => {
  it("uses an approved label, and no two exhibits share one", () => {
    const labels = exhibits.map((e) => e.context.label);
    for (const label of labels) {
      expect(CONTEXT_LABELS).toContain(label);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("carries no project identity, hidden or otherwise", () => {
    for (const exhibit of exhibits) {
      const keys = Object.keys(exhibit.context).sort();
      expect(keys, exhibit.slug).toEqual(["description", "label"]);
      expect(exhibit).not.toHaveProperty("project");
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
