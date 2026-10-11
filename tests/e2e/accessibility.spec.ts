import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/about",
  "/exhibits/drawer-scroll-lock",
  "/exhibits/circuit-breaker-half-open",
  "/exhibits/local-day-boundary",
  "/exhibits/speech-restart-loop",
  "/exhibits/deleted-account-resurrection",
  "/exhibits/double-submit-skipped-blank",
];

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: string[] = [];

    /* A code block is allowed to be wider than the phone — it lives in its own
       scroll container and clips. What is not allowed is the page itself
       moving sideways, so anything inside a horizontal scroller is exempt. */
    const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    const scrollers = new Set<HTMLElement>();
    for (const el of all) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === "auto" || overflow === "scroll" || overflow === "hidden") {
        scrollers.add(el);
      }
    }

    const insideScroller = (el: HTMLElement) => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        if (scrollers.has(node)) return true;
        node = node.parentElement;
      }
      return false;
    };

    for (const el of all) {
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      if (insideScroller(el)) continue;
      if (box.right > doc.clientWidth + 1) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)} → ${Math.round(box.right)}`,
        );
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      offenders: offenders.slice(0, 6),
    };
  });

test.describe("360px, the narrowest phone worth supporting", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(200);
      const result = await horizontalOverflow(page);
      expect(result.offenders, `overflowing elements on ${route}`).toEqual([]);
      expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
    });
  }

  test("the drawer simulation still works on a 360px screen", async ({ page }) => {
    await page.goto("/exhibits/drawer-scroll-lock#fixed");
    await page.getByRole("button", { name: "Scroll to the middle" }).click();
    const viewport = page.locator("[class*=viewport]").first();
    const y = await viewport.evaluate((el) => Math.round(el.scrollTop));

    await page.getByRole("button", { name: "Open the drawer" }).click();
    expect(await viewport.evaluate((el) => Math.round(el.scrollTop))).toBe(0);

    await page.keyboard.press("Escape");
    await expect
      .poll(async () => viewport.evaluate((el) => Math.round(el.scrollTop)))
      .toBe(y);
  });
});

test.describe("keyboard", () => {
  test("the skip link is the first stop and jumps to the content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    expect(new URL(page.url()).hash).toBe("#main");
  });

  test("the state selector is one tab stop, driven by arrow keys", async ({
    page,
  }) => {
    await page.goto("/exhibits/local-day-boundary");
    const group = page.getByRole("radiogroup", { name: /which version/i });
    await group.getByRole("radio", { name: /^Broken$/ }).focus();

    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: /First fix/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(group.getByRole("radio", { name: /First fix/ })).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: /^Fixed$/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("everything focusable shows a visible ring", async ({ page }) => {
    await page.goto("/exhibits/circuit-breaker-half-open");
    const button = page.getByRole("button", { name: "Fail a request" });
    await button.focus();

    const outline = await button.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: cs.outlineWidth,
        style: cs.outlineStyle,
        color: cs.outlineColor,
      };
    });
    expect(outline.style).not.toBe("none");
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test("the whole drawer simulation can be driven without a mouse", async ({
    page,
  }) => {
    await page.goto("/exhibits/drawer-scroll-lock#broken");

    await page.getByRole("button", { name: "Scroll to the middle" }).focus();
    await page.keyboard.press("Enter");

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Open the drawer" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    // Opening the drawer moves focus into it. It is not modal: the controls
    // beside the case stay usable, so it must not claim aria-modal.
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Navigation" })).not.toHaveAttribute(
      "aria-modal",
      "true",
    );

    await page.getByRole("button", { name: "Push the background" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page
        .getByRole("list", { name: "Drawer simulation event log" })
        .getByText(/scrollTop moved/),
    ).toBeVisible();

    // Escape works from anywhere while the drawer is open.
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open the drawer" }),
    ).toBeVisible();
  });
});

test.describe("prefers-reduced-motion", () => {
  /* emulateMedia rather than test.use: the headless shell used here does not
     apply the context-level reducedMotion option, and a media-query test that
     silently runs without the media query is worse than no test. */
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the restore is still visibly a journey, in steps", async ({ page }) => {
    await page.goto("/exhibits/drawer-scroll-lock#first-fix");
    await page.getByRole("button", { name: "Scroll to the middle" }).click();
    const viewport = page.locator("[class*=viewport]").first();
    const y = await viewport.evaluate((el) => Math.round(el.scrollTop));
    await page.getByRole("button", { name: "Open the drawer" }).click();

    /* Sample every frame. "Still travelling" alone would pass for a smooth
       glide too, which is exactly what reduced motion asked not to see. */
    await viewport.evaluate((el) => {
      const seen: number[] = [];
      (window as unknown as { __restore: number[] }).__restore = seen;
      const started = performance.now();
      const tick = () => {
        seen.push(Math.round(el.scrollTop));
        if (performance.now() - started < 1600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole("button", { name: "Close the drawer" }).click();
    await expect(page.getByTestId("frame-verdict")).toContainText(
      "still travelling",
    );
    await page.waitForTimeout(1800);

    const positions = await page.evaluate(() => [
      ...new Set((window as unknown as { __restore: number[] }).__restore),
    ]);
    expect(positions.at(-1)).toBe(y);
    expect(positions.length, positions.join(" → ")).toBeGreaterThanOrEqual(3);
    expect(positions.length, positions.join(" → ")).toBeLessThanOrEqual(6);
  });

  test("decorative transitions are switched off", async ({ page }) => {
    await page.goto("/");
    const info = await page.evaluate(() => ({
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      dur: getComputedStyle(document.documentElement)
        .getPropertyValue("--dur")
        .trim(),
    }));

    expect(info.matches).toBe(true);
    expect(info.dur).toBe("1ms");
  });

  test("the fixed state is still instant", async ({ page }) => {
    await page.goto("/exhibits/drawer-scroll-lock#fixed");
    await page.getByRole("button", { name: "Scroll to the middle" }).click();
    const viewport = page.locator("[class*=viewport]").first();
    const y = await viewport.evaluate((el) => Math.round(el.scrollTop));

    await page.getByRole("button", { name: "Open the drawer" }).click();
    await page.getByRole("button", { name: "Close the drawer" }).click();

    await expect(page.getByTestId("frame-verdict")).toContainText("by frame two");
    expect(await viewport.evaluate((el) => Math.round(el.scrollTop))).toBe(y);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the gallery still lists every exhibit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const links = page.locator('a[href^="/exhibits/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(6);
  });

  test("an exhibit page still reads as an article", async ({ page }) => {
    await page.goto("/exhibits/circuit-breaker-half-open");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What happened" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Proof it stays fixed/ })).toBeVisible();
  });
});

test.describe("metadata", () => {
  test("the home page carries a full set of tags", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Bug Museum/);
    const meta = async (selector: string) =>
      page.locator(selector).first().getAttribute("content");

    expect(await meta('meta[name="description"]')).toContain(
      "anonymised debugging cases",
    );
    expect(await meta('meta[property="og:title"]')).toContain("Bug Museum");
    expect(await meta('meta[property="og:image"]')).toContain(
      "/opengraph-image",
    );
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });

  test("each exhibit has its own title and description", async ({ page }) => {
    await page.goto("/exhibits/local-day-boundary");
    await expect(page).toHaveTitle(/day that was only 23 hours long/);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toContain("streak");
  });

  test("every exhibit can be shared with a picture, under its own address", async ({
    page,
  }) => {
    for (const slug of [
      "drawer-scroll-lock",
      "circuit-breaker-half-open",
      "local-day-boundary",
      "speech-restart-loop",
      "deleted-account-resurrection",
      "double-submit-skipped-blank",
    ]) {
      await page.goto(`/exhibits/${slug}`);
      const meta = (selector: string) =>
        page.locator(selector).first().getAttribute("content");
      expect(await meta('meta[property="og:image"]'), slug).toContain("/opengraph-image");
      expect(await meta('meta[name="twitter:image"]'), slug).toContain("/opengraph-image");
      expect(await meta('meta[property="og:url"]'), slug).toMatch(
        new RegExp(`/exhibits/${slug}$`),
      );
    }
  });

  test("the about page shares as itself", async ({ page }) => {
    await page.goto("/about");
    const meta = (selector: string) =>
      page.locator(selector).first().getAttribute("content");
    expect(await meta('meta[property="og:url"]')).toMatch(/\/about$/);
    expect(await meta('meta[property="og:title"]')).toContain("About");
    expect(await meta('meta[property="og:image"]')).toContain("/opengraph-image");
    const description = (await meta('meta[name="description"]')) ?? "";
    expect(description).not.toContain("what is tested");
    expect(description).toContain("changed");
  });

  test("a missing page says so, and asks not to be indexed", async ({ page }) => {
    const response = await page.goto("/exhibits/not-a-real-bug");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/not found/i);

    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute("content")),
    );
    expect(robots).toEqual(["noindex"]);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });

  test("the sitemap lists every route", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = (await response?.text()) ?? "";
    expect(body).toContain("/exhibits/drawer-scroll-lock");
    expect(body).toContain("/about");
  });
});
