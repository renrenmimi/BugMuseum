import { expect, test } from "@playwright/test";

test.describe("exhibit 02 — the circuit breaker", () => {
  const open = async (page: import("@playwright/test").Page, hash: string) => {
    await page.goto(`/exhibits/circuit-breaker-half-open${hash}`);
    for (let i = 0; i < 3; i += 1) {
      await page.getByRole("button", { name: "Fail a request" }).click();
    }
    await page.getByRole("button", { name: "Wait 30s" }).click();
  };

  test("a pre-flight strands the broken endpoint for good", async ({ page }) => {
    await open(page, "#broken");
    await page.getByRole("button", { name: "Pre-flight check" }).click();
    await page.getByRole("button", { name: "Send a request" }).click();

    await expect(page.getByTestId("breaker-verdict")).toContainText(
      "no probe in flight",
    );
    await expect(page.getByText("half-open").first()).toBeVisible();
  });

  test("the fixed endpoint recovers after the same sequence", async ({ page }) => {
    await open(page, "#fixed");
    for (let i = 0; i < 3; i += 1) {
      await page.getByRole("button", { name: "Pre-flight check" }).click();
    }
    await page.getByRole("button", { name: "Send a request" }).click();

    await expect(page.getByTestId("breaker-verdict")).toContainText(
      "Asking is free",
    );
  });
});

test.describe("exhibit 03 — the day boundary", () => {
  test("switching state changes both halves of the case", async ({ page }) => {
    await page.goto("/exhibits/local-day-boundary#broken");
    await expect(page.getByTestId("walk-verdict")).toContainText("2026-03-08");
    await expect(page.getByTestId("drill-verdict")).toContainText("mid-afternoon");

    await page.getByRole("radio", { name: /First fix/ }).click();
    await expect(page.getByTestId("walk-verdict")).toContainText(
      "visited exactly once",
    );
    await expect(page.getByTestId("drill-verdict")).toContainText("mid-afternoon");

    await page.getByRole("radio", { name: /^Fixed$/ }).click();
    await expect(page.getByTestId("walk-verdict")).toContainText(
      "visited exactly once",
    );
    await expect(page.getByTestId("drill-verdict")).toContainText("local midnight");
  });

  test("the clock slider changes the answer", async ({ page }) => {
    await page.goto("/exhibits/local-day-boundary#broken");
    await expect(page.getByTestId("walk-verdict")).toContainText("never looked at");

    const slider = page.getByRole("slider");
    await slider.focus();
    for (let i = 0; i < 9; i += 1) await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("walk-verdict")).toContainText(
      "visited exactly once",
    );
  });
});

test.describe("exhibit 04 — the restart loop", () => {
  test("the broken version transcribes nothing", async ({ page }) => {
    await page.goto("/exhibits/speech-restart-loop#broken");
    await expect(page.getByTestId("deps")).toContainText("[isRecognizing, language]");

    const step = page.getByRole("button", { name: "Step one tick" });
    for (let i = 0; i < 8; i += 1) await step.click();

    await expect(page.getByTestId("transcript")).toContainText("discarded");
  });

  test("the fixed version keeps a sentence", async ({ page }) => {
    await page.goto("/exhibits/speech-restart-loop#fixed");
    await expect(page.getByTestId("deps")).toContainText("[language]");

    const step = page.getByRole("button", { name: "Step one tick" });
    for (let i = 0; i < 8; i += 1) await step.click();

    await expect(page.getByTestId("transcript")).toContainText("I think");
  });
});

test.describe("exhibit 05 — the two tabs", () => {
  const walkToEnd = async (page: import("@playwright/test").Page) => {
    const next = page.getByRole("button", { name: "Next step" });
    for (let i = 0; i < 12; i += 1) {
      if (await next.isDisabled()) break;
      await next.click();
    }
  };

  test("the broken version resurrects the account", async ({ page }) => {
    await page.goto("/exhibits/deleted-account-resurrection#broken");
    await walkToEnd(page);
    await expect(page.getByText("recreated ⚠")).toBeVisible();
  });

  test("the first fix stops it but keeps stale caches", async ({ page }) => {
    await page.goto("/exhibits/deleted-account-resurrection#first-fix");
    await walkToEnd(page);
    await expect(page.getByText("recreated ⚠")).toHaveCount(0);
    await expect(page.getByTestId("tabs-frame")).toContainText("three caches");
  });

  test("the fixed version leaves nothing behind", async ({ page }) => {
    await page.goto("/exhibits/deleted-account-resurrection#fixed");
    await walkToEnd(page);
    await expect(page.getByText("recreated ⚠")).toHaveCount(0);
    await expect(page.getByTestId("tabs-frame")).toContainText(
      "Nothing left to resurrect",
    );
  });

  test("Back steps the story in reverse", async ({ page }) => {
    await page.goto("/exhibits/deleted-account-resurrection#broken");
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    const third = await page.getByTestId("tabs-frame").textContent();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("tabs-frame")).not.toHaveText(third ?? "");
  });
});

test.describe("exhibit 06 — the double submit", () => {
  test("two Enters skip a blank", async ({ page }) => {
    await page.goto("/exhibits/double-submit-skipped-blank#broken");
    await page.getByRole("button", { name: "Fill the answer" }).click();
    await page.getByTestId("double-enter").click();

    await expect(page.getByTestId("timer-queue")).toContainText("advance");
    await expect(page.getByTestId("blank-prompt")).toContainText("Blank 3 of 3");
    await expect(page.getByText("skipped", { exact: true })).toBeVisible();
  });

  test("the mutex swallows the second Enter", async ({ page }) => {
    await page.goto("/exhibits/double-submit-skipped-blank#fixed");
    await page.getByRole("button", { name: "Fill the answer" }).click();
    await page.getByTestId("double-enter").click();

    await expect(page.getByTestId("blank-prompt")).toContainText("Blank 2 of 3");
    await expect(page.getByText("skipped", { exact: true })).toHaveCount(0);
  });

  test("typing and pressing Enter works like a real form", async ({ page }) => {
    await page.goto("/exhibits/double-submit-skipped-blank#fixed");
    const input = page.getByLabel("Your answer");
    await input.fill("messages");
    await input.press("Enter");

    await expect(page.getByTestId("blank-prompt")).toContainText("Blank 2 of 3");
  });

  test("a wrong answer is rejected without advancing", async ({ page }) => {
    await page.goto("/exhibits/double-submit-skipped-blank#fixed");
    const input = page.getByLabel("Your answer");
    await input.fill("nope");
    await input.press("Enter");

    await expect(page.getByText("Not quite — try again.")).toBeVisible();
    await expect(page.getByTestId("blank-prompt")).toContainText("Blank 1 of 3");
  });
});

test.describe("state switching resets the object in the case", () => {
  test("the drawer demo comes back to the top when the state changes", async ({
    page,
  }) => {
    await page.goto("/exhibits/drawer-scroll-lock#broken");
    await page.getByRole("button", { name: "Scroll to the middle" }).click();
    const viewport = page.locator("[class*=viewport]").first();
    expect(await viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.getByRole("radio", { name: /^Fixed$/ }).click();
    await expect
      .poll(async () => viewport.evaluate((el) => Math.round(el.scrollTop)))
      .toBe(0);
  });

  test("the breaker resets its clock when the state changes", async ({ page }) => {
    await page.goto("/exhibits/circuit-breaker-half-open#broken");
    await page.getByRole("button", { name: "Wait 30s" }).click();
    await page.getByRole("radio", { name: /^Fixed$/ }).click();

    await expect(page.getByText("0s").first()).toBeVisible();
  });
});
