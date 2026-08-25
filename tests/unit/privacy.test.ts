import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { exhibits } from "@/content/exhibits";
import {
  CONTEXT_LABELS,
  MUSEUM_REPO,
  exhibitStrings,
  findPrivacyIssues,
  findTextPrivacyIssues,
  isAllowedHref,
} from "@/content/schema";

/* ============================================================
   The cases in this museum came out of real project work, and the
   projects are not the point. These tests are what stops an
   identity creeping back in — over exhibit data, over the files
   that get shipped, and over the tracked tree as a whole.

   Note what is deliberately absent: a list of the names being kept
   out. Writing them down here would put them back into a tracked
   file, which is the thing being avoided. The rules are patterns.
   ============================================================ */

const tracked = () =>
  execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f.length > 0);

const TEXT_FILE = /\.(ts|tsx|css|md|json|mjs|js|svg|txt|yml|yaml)$/;

/** Files whose whole job is to describe or exercise these rules. They contain
    example strings that are supposed to fail, which is the point of them. */
const RULE_FILES = new Set([
  "content/schema.ts",
  "tests/unit/privacy.test.ts",
  "tests/unit/exhibits.test.ts",
]);

describe("exhibit data", () => {
  it("carries no provenance that points outside this project", () => {
    const issues = exhibits.flatMap(findPrivacyIssues);
    expect(issues.map((i) => `${i.field}: ${i.problem}`)).toEqual([]);
  });

  it("labels every exhibit by an approved technical setting", () => {
    for (const exhibit of exhibits) {
      expect(CONTEXT_LABELS, exhibit.slug).toContain(exhibit.context.label);
    }
  });

  it("keeps every href inside this project", () => {
    for (const exhibit of exhibits) {
      for (const [field, text] of exhibitStrings(exhibit)) {
        if (!field.endsWith(".href")) continue;
        expect(isAllowedHref(text), `${exhibit.slug}.${field}`).toBe(true);
      }
    }
  });
});

describe("the rules themselves", () => {
  it("rejects a bare commit hash", () => {
    /* Invented hex, not a hash from anywhere: the point is the shape. */
    const issues = findTextPrivacyIssues("shipped in 4b7c1e9", "t");
    expect(issues.some((i) => i.problem.includes("commit hash"))).toBe(true);
  });

  it("rejects a pull-request reference", () => {
    for (const text of ["fixed in PR #7", "see pull request #802", "/pull/7"]) {
      const issues = findTextPrivacyIssues(text, "t");
      expect(
        issues.some((i) => i.problem.includes("pull request")),
        text,
      ).toBe(true);
    }
  });

  it("rejects a link to another repository under the same owner", () => {
    /* Derived from MUSEUM_REPO so this file contains no such link itself. */
    const sameOwnerOtherRepo = MUSEUM_REPO.replace(/BugMuseum$/, "SomeOtherRepo");
    const issues = findTextPrivacyIssues(`see ${sameOwnerOtherRepo}`, "t");
    expect(issues.some((i) => i.problem.includes("another repository"))).toBe(true);
  });

  it("accepts a link to this repository", () => {
    const issues = findTextPrivacyIssues(
      `${MUSEUM_REPO}/blob/main/lib/sims/two-tabs.ts`,
      "t",
    );
    expect(issues).toEqual([]);
  });

  it("rejects a word shaped like a product name", () => {
    const issues = findTextPrivacyIssues("built with SomeStudio", "t");
    expect(issues.some((i) => i.problem.includes("product name"))).toBe(true);
  });

  it("allows the technology names it has been told about", () => {
    expect(
      findTextPrivacyIssues(
        "TypeScript and SpeechRecognition on GitHub, in BugMuseum",
        "t",
      ),
    ).toEqual([]);
  });

  it("does not flag ordinary prose or lowercase identifiers", () => {
    expect(
      findTextPrivacyIssues(
        "The useEffect body calls recognition.stop() and setDate(-1).",
        "t",
      ),
    ).toEqual([]);
  });
});

describe("every tracked text file", () => {
  const files = tracked().filter(
    (f) => TEXT_FILE.test(f) && !f.startsWith("package-lock"),
  );

  it("finds a reasonable number of files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("links only to this repository", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      if (RULE_FILES.has(f)) continue;
      for (const [, repo] of body.matchAll(
        /https:\/\/github\.com\/renrenmimi\/([A-Za-z0-9._-]+)/g,
      )) {
        if (repo !== "BugMuseum") offenders.push(`${f} → ${repo}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("mentions no commit hashes or pull requests outside the rule files", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (RULE_FILES.has(f)) continue;
      const body = readFileSync(f, "utf8");
      for (const match of body.matchAll(
        /\b(?:PR|pull request)\s*#\s*\d+|(?<![\w/-])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w-])/g,
      )) {
        offenders.push(`${f} → ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("what the shipped pages say", () => {
  /* The exhibit pages and the gallery are rendered from exhibit data, so
     scanning the data covers them. The static copy around them is not, so it
     gets the same treatment. */
  const COPY_FILES = [
    "app/page.tsx",
    "app/about/page.tsx",
    "app/layout.tsx",
    "app/opengraph-image.tsx",
    "app/sitemap.ts",
    "app/robots.ts",
    "README.md",
  ];

  for (const f of COPY_FILES) {
    it(`${f} names no project and cites nothing outside this repository`, () => {
      const body = readFileSync(f, "utf8");
      const issues = findTextPrivacyIssues(body, f).filter(
        /* Source code legitimately contains identifiers with internal capitals;
           only prose and links are of interest in these files. */
        (i) => !i.problem.includes("product name"),
      );
      expect(issues.map((i) => i.problem)).toEqual([]);
    });
  }

  it("keeps the six context labels as the only setting names in the copy", () => {
    const gallery = readFileSync("app/page.tsx", "utf8");
    const about = readFileSync("app/about/page.tsx", "utf8");
    for (const source of [gallery, about]) {
      expect(source).not.toMatch(/\bproject\.(name|repo|href|blurb)\b/);
    }
    expect(CONTEXT_LABELS).toHaveLength(6);
  });
});
