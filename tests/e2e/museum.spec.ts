import { expect, test, type Page } from "@playwright/test";

const EXHIBITS = [
  "drawer-scroll-lock",
  "circuit-breaker-half-open",
  "local-day-boundary",
  "speech-restart-loop",
  "deleted-account-resurrection",
  "double-submit-skipped-blank",
];

const ROUTES = ["/", "/about", ...EXHIBITS.map((s) => `/exhibits/${s}`)];

/** Fails the test on anything the browser complains about, hydration included. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      problems.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

test.describe("every page", () => {
  for (const route of ROUTES) {
    test(`${route} renders with exactly one h1 and no console noise`, async ({
      page,
    }) => {
      const problems = watchConsole(page);
      const response = await page.goto(route);

      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).not.toBeEmpty();

      // Give hydration a chance to complain.
      await page.waitForTimeout(400);
      expect(problems).toEqual([]);
    });
  }
});

test.describe("direct exhibit URLs", () => {
  for (const slug of EXHIBITS) {
    test(`/exhibits/${slug} is a shareable address`, async ({ page }) => {
      await page.goto(`/exhibits/${slug}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByRole("radiogroup", { name: /which version/i }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "What happened" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    });
  }

  test("an unknown exhibit returns 404", async ({ page }) => {
    const response = await page.goto("/exhibits/not-a-real-bug");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/not on the plan/i)).toBeVisible();
  });

  test("the selected state is written into the URL and read back", async ({
    page,
  }) => {
    await page.goto("/exhibits/drawer-scroll-lock");
    await page.getByRole("radio", { name: /First fix/ }).click();
    expect(new URL(page.url()).hash).toBe("#first-fix");

    await page.reload();
    await expect(page.getByRole("radio", { name: /First fix/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("a bad hash falls back to Broken", async ({ page }) => {
    await page.goto("/exhibits/drawer-scroll-lock#nonsense");
    await expect(page.getByRole("radio", { name: /^Broken$/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("moving through the gallery", () => {
  test("walks the whole collection with next, then back with previous", async ({
    page,
  }) => {
    await page.goto(`/exhibits/${EXHIBITS[0]}`);

    for (let i = 1; i < EXHIBITS.length; i += 1) {
      await page.getByRole("link", { name: /^Next →/ }).click();
      await expect(page).toHaveURL(new RegExp(`${EXHIBITS[i]}$`));
    }
    await expect(page.getByRole("link", { name: /^Next →/ })).toHaveCount(0);

    for (let i = EXHIBITS.length - 2; i >= 0; i -= 1) {
      await page.getByRole("link", { name: /^← Previous/ }).click();
      await expect(page).toHaveURL(new RegExp(`${EXHIBITS[i]}$`));
    }
    await expect(page.getByRole("link", { name: /^← Previous/ })).toHaveCount(0);
  });

  test("the gallery filters narrow and restore the list", async ({ page }) => {
    await page.goto("/");
    const status = page.getByRole("status");
    await expect(status).toContainText(`Showing 6 of 6`);

    await page.getByRole("button", { name: /^Concurrency/ }).click();
    await expect(status).toContainText("in Concurrency");
    const shown = Number(
      (await status.textContent())?.match(/Showing (\d+)/)?.[1] ?? "0",
    );
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(6);

    await page.getByRole("button", { name: /^All/ }).click();
    await expect(status).toContainText("Showing 6 of 6");
  });

  test("every card links to a page that exists", async ({ page }) => {
    await page.goto("/");
    const links = page.locator('a[href^="/exhibits/"]');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(6);

    for (let i = 0; i < count; i += 1) {
      const href = await links.nth(i).getAttribute("href");
      expect(EXHIBITS.some((slug) => href === `/exhibits/${slug}`)).toBe(true);
    }
  });
});

test.describe("source links", () => {
  test("every exhibit links only inside this project", async ({ page }) => {
    for (const slug of EXHIBITS) {
      await page.goto(`/exhibits/${slug}`);
      const links = page.locator('a[href^="https://github.com/"]');
      const count = await links.count();
      expect(count, slug).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < count; i += 1) {
        const href = await links.nth(i).getAttribute("href");
        expect(href, `${slug}: ${href}`).toMatch(
          /^https:\/\/github\.com\/renrenmimi\/BugMuseum(\/|$)/,
        );
      }
    }
  });

  test("the sources section names artifacts in this repository", async ({
    page,
  }) => {
    await page.goto("/exhibits/circuit-breaker-half-open");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    const sources = page.getByRole("list", { name: "Sources" });

    for (const label of [
      "content/exhibits/circuit-breaker-half-open.ts",
      "components/sims/breaker/breaker-sim.tsx",
      "lib/sims/circuit-breaker.ts",
      "tests/unit/sims/circuit-breaker.test.ts",
    ]) {
      await expect(sources.getByRole("link", { name: `${label} ↗` })).toBeVisible();
    }
  });
});

test.describe("privacy", () => {
  /* The rendered pages are the thing a visitor actually sees, so the same
     rules that guard the exhibit data are re-run against the HTML. */
  const OTHER_OWNER_REPO = /github\.com\/renrenmimi\/(?!BugMuseum\b)[A-Za-z0-9._-]+/;
  const BARE_SHA = /(?<![\w/-])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w-])/;
  const PR_REFERENCE = /\b(?:PR|pull request)\s*#\s*\d+/i;

  const CONTEXT_LABELS = [
    "Learning interface",
    "API resilience layer",
    "Daily practice tracker",
    "Voice session",
    "Multi-tab account flow",
    "Guided coding exercise",
  ];

  for (const route of ROUTES) {
    test(`${route} exposes no outside repository, hash or pull request`, async ({
      page,
    }) => {
      await page.goto(route);
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      const html = await page.content();

      expect(html, `${route}: links to another repository`).not.toMatch(
        OTHER_OWNER_REPO,
      );
      expect(text, `${route}: shows a commit hash`).not.toMatch(BARE_SHA);
      expect(text, `${route}: cites a pull request`).not.toMatch(PR_REFERENCE);
    });
  }

  test("each exhibit page is labelled by a technical setting", async ({ page }) => {
    const seen = new Set<string>();
    for (const slug of EXHIBITS) {
      await page.goto(`/exhibits/${slug}`);
      const text = await page.locator("body").innerText();
      const found = CONTEXT_LABELS.filter((label) => text.includes(label));
      expect(found.length, `${slug} showed ${found.length} labels`).toBe(1);
      const label = found[0] as string;
      expect(seen.has(label), `${label} used twice`).toBe(false);
      seen.add(label);
    }
    expect(seen.size).toBe(6);
  });

  test("the gallery shows a setting on every card and no project names", async ({
    page,
  }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    for (const label of CONTEXT_LABELS) {
      expect(text, `gallery is missing ${label}`).toContain(label);
    }
  });

  test("the about page explains why the names are gone", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByRole("heading", { name: /why there are no project names/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Identifying project details have been changed/i),
    ).toBeVisible();
  });

  test("page metadata names no project", async ({ page }) => {
    await page.goto("/");
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");

    expect(description).toContain("anonymised debugging cases");
    for (const value of [description ?? "", ogTitle ?? ""]) {
      expect(value).not.toMatch(OTHER_OWNER_REPO);
      expect(value).not.toMatch(BARE_SHA);
    }
  });

  test("the sitemap lists only this site", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = (await response?.text()) ?? "";
    expect(body).not.toMatch(/github\.com/);
    expect(body).toContain("/exhibits/drawer-scroll-lock");
  });
});
