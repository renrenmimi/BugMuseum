/* Visual QA: full-page captures at desktop and 390px, written to ./screenshots.
   Not part of the test suite — a screenshot proves nothing about behaviour,
   it just shows you where the wrapping is wrong. */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3123";
const OUT = "screenshots";

const PAGES = [
  ["home", "/"],
  ["about", "/about"],
  ["exhibit-01-drawer", "/exhibits/drawer-scroll-lock"],
  ["exhibit-02-breaker", "/exhibits/circuit-breaker-half-open"],
  ["exhibit-03-day", "/exhibits/local-day-boundary"],
  ["exhibit-04-restart", "/exhibits/speech-restart-loop"],
  ["exhibit-05-tabs", "/exhibits/deleted-account-resurrection"],
  ["exhibit-06-blanks", "/exhibits/double-submit-skipped-blank"],
];

const SIZES = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
  ["narrow", { width: 360, height: 740 }],
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const [sizeName, viewport] of SIZES) {
  const page = await browser.newPage({ viewport });
  for (const [name, route] of PAGES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${OUT}/${sizeName}-${name}.png`,
      fullPage: true,
    });
    process.stdout.write(`${sizeName}/${name} `);
  }
  await page.close();
}

await browser.close();
console.log("\ndone");
