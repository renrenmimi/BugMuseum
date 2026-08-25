import { expect, test, type Page } from "@playwright/test";

/* ============================================================
   Exhibit 01, in the museum's own words: the port of DrillLab's
   lock2.mjs. The assertion that matters is a frame sample — if you
   wait for the scroll to settle, the broken version arrives too
   and the test passes for the wrong reason.
   ============================================================ */

const URL = "/exhibits/drawer-scroll-lock";

const viewport = (page: Page) => page.locator("[class*=viewport]").first();
const scrollTop = (page: Page) =>
  viewport(page).evaluate((el) => Math.round(el.scrollTop));

async function selectState(page: Page, name: RegExp) {
  await page
    .getByRole("radiogroup", { name: /which version/i })
    .getByRole("radio", { name })
    .click();
}

async function scrollToMiddle(page: Page) {
  await page.getByRole("button", { name: "Scroll to the middle" }).click();
  const y = await scrollTop(page);
  expect(y).toBeGreaterThan(100);
  return y;
}

const openDrawer = (page: Page) =>
  page.getByRole("button", { name: "Open the drawer" }).click();

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("radiogroup", { name: /which version/i })).toBeVisible();
});

test("the phone scrolls, and the demo starts in the Broken state", async ({ page }) => {
  await expect(
    page.getByRole("radio", { name: /^Broken$/ }),
  ).toHaveAttribute("aria-checked", "true");

  const before = await scrollTop(page);
  await scrollToMiddle(page);
  expect(await scrollTop(page)).toBeGreaterThan(before);
});

test("Broken: the page keeps moving behind the drawer", async ({ page }) => {
  const y = await scrollToMiddle(page);
  await openDrawer(page);

  await page.getByRole("button", { name: "Push the background" }).click();

  const after = await scrollTop(page);
  expect(after).toBeGreaterThan(y);
  await expect(page.getByText(/scrollTop moved/)).toBeVisible();
});

test("First fix: the background is locked but the restore is animated", async ({
  page,
}) => {
  await selectState(page, /First fix/);
  const y = await scrollToMiddle(page);
  await openDrawer(page);

  await page.getByRole("button", { name: "Push the background" }).click();
  await expect(page.getByText(/the page is locked/)).toBeVisible();

  await page.getByRole("button", { name: "Close the drawer" }).click();

  const verdict = page.getByTestId("frame-verdict");
  await expect(verdict).toBeVisible();
  await expect(verdict).toContainText("still travelling");
  await expect(verdict).toContainText(String(y));
});

test("Fixed: the position is back by the second frame", async ({ page }) => {
  await selectState(page, /^Fixed$/);
  const y = await scrollToMiddle(page);
  await openDrawer(page);

  await page.getByRole("button", { name: "Push the background" }).click();
  await expect(page.getByText(/the page is locked/)).toBeVisible();

  await page.getByRole("button", { name: "Close the drawer" }).click();

  const verdict = page.getByTestId("frame-verdict");
  await expect(verdict).toContainText("by frame two");
  await expect(verdict).toContainText(String(y));

  expect(await scrollTop(page)).toBe(y);
});

test("the simulation really is scrolling smoothly, or the test means nothing", async ({
  page,
}) => {
  const behaviour = await viewport(page).evaluate(
    (el) => getComputedStyle(el).scrollBehavior,
  );
  expect(behaviour).toBe("smooth");
});

test("every way of closing lands on the same pixel when fixed", async ({ page }) => {
  await selectState(page, /^Fixed$/);

  for (const close of ["scrim", "hamburger", "escape"] as const) {
    await page.getByRole("button", { name: "Scroll to the middle" }).click();
    const y = await scrollTop(page);
    await openDrawer(page);

    if (close === "scrim") {
      /* The drawer covers the left 76% of the screen, so the only part of
         the scrim you can actually hit is on the right. */
      const box = await page.locator("#drawer-sim-scrim").boundingBox();
      await page.mouse.click(
        (box?.x ?? 0) + (box?.width ?? 0) - 12,
        (box?.y ?? 0) + 140,
      );
    } else if (close === "hamburger") {
      await page.getByTestId("phone-burger").click();
    } else {
      await page.keyboard.press("Escape");
    }

    await expect(page.getByRole("button", { name: "Open the drawer" })).toBeVisible();
    expect(await scrollTop(page), `closed by ${close}`).toBe(y);
  }
});

test("Escape closes the drawer and gives focus back to the hamburger", async ({
  page,
}) => {
  await selectState(page, /^Fixed$/);
  await scrollToMiddle(page);
  await openDrawer(page);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open the drawer" })).toBeVisible();

  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("data-testid") ?? "",
  );
  expect(focused).toBe("phone-burger");
});

test("following a link in the drawer starts the new page at the top", async ({
  page,
}) => {
  await selectState(page, /^Fixed$/);
  await scrollToMiddle(page);
  await openDrawer(page);

  await page.getByRole("button", { name: "Graphs" }).click();

  await expect(page.getByText("followed a link to Graphs")).toBeVisible();
  await expect
    .poll(async () => scrollTop(page), { timeout: 2000 })
    .toBe(0);
});

test("wheeling over the scrim cannot move a locked page", async ({ page }) => {
  await selectState(page, /^Fixed$/);
  const y = await scrollToMiddle(page);
  await openDrawer(page);

  // While the body is fixed the document's own scroll offset is 0.
  expect(await scrollTop(page)).toBe(0);

  const box = await page.locator("#drawer-sim-scrim").boundingBox();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) - 12,
    (box?.y ?? 0) + 120,
  );
  await page.mouse.wheel(0, 500);
  expect(await scrollTop(page)).toBe(0);

  await page.keyboard.press("Escape");
  await expect.poll(async () => scrollTop(page), { timeout: 2000 }).toBe(y);
});

test("wheeling over the scrim does move an unlocked one", async ({ page }) => {
  const y = await scrollToMiddle(page);
  await openDrawer(page);

  const box = await page.locator("#drawer-sim-scrim").boundingBox();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) - 12,
    (box?.y ?? 0) + 120,
  );
  await page.mouse.wheel(0, 300);

  await expect
    .poll(async () => scrollTop(page), { timeout: 2000 })
    .toBeGreaterThan(y);
});

test("the phone scrolls with a real wheel, not just the buttons", async ({ page }) => {
  await viewport(page).scrollIntoViewIfNeeded();
  const box = await viewport(page).boundingBox();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.wheel(0, 400);

  await expect
    .poll(async () => scrollTop(page), { timeout: 2000 })
    .toBeGreaterThan(50);
});
