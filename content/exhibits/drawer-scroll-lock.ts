import type { Exhibit } from "../schema";
import { MUSEUM_REPO } from "../schema";

const file = (path: string) => `${MUSEUM_REPO}/blob/main/${path}`;

const DEFINITION = file("content/exhibits/drawer-scroll-lock.ts");
const SIMULATION = file("components/sims/drawer/drawer-sim.tsx");
const CASE_CSS = file("components/sims/drawer/drawer.module.css");
const E2E = file("tests/e2e/drawer.spec.ts");

export const drawerScrollLock: Exhibit = {
  slug: "drawer-scroll-lock",
  number: 1,
  title: "The drawer that let the page slide out from under it",
  summary:
    "A mobile navigation drawer left the page behind it scrollable, and the fix for that made the page take a 1.5-second tour back to where it started.",
  featured: true,
  context: {
    label: "Learning interface",
    description:
      "A study interface read mostly on a phone, where the sidebar collapses into a drawer below 960px.",
  },
  categories: ["browser", "state"],
  tech: ["React", "CSS", "Mobile Safari", "Playwright"],
  simulation: "drawer-scroll-lock",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "The scrim stops clicks, not scrolling — the page keeps moving behind the drawer.",
      tryThis: [
        "Scroll the phone to somewhere in the middle, then open the drawer.",
        "Scroll again with the drawer open, and watch the page behind it move.",
        "Close the drawer: you are no longer where you left off.",
      ],
    },
    {
      key: "first-fix",
      label: "First fix",
      headline:
        "The body is locked, so nothing moves — but closing takes a slow ride back.",
      tryThis: [
        "Open the drawer from the middle of the page: the background is frozen now.",
        "Close it and watch the page drop to the top and crawl back.",
        "Press Escape instead of tapping the scrim — same crawl.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "The lock holds, and the position comes back on the very next frame.",
      tryThis: [
        "Open and close the drawer from the middle: nothing appears to move at all.",
        "Try every way out — Escape, the scrim, the hamburger.",
        "Follow a link in the drawer: a new page is supposed to start at the top.",
      ],
    },
  ],

  whatHappened: [
    "The interface was read mostly on phones, so below 960px the sidebar became a drawer with a translucent scrim behind it. Someone opened the drawer halfway down a long page, dragged a finger over the scrim, and the page underneath went with it.",
    "A scrim is a click target. It absorbs pointer events, which is why tapping it closes the drawer — but it does not stop the page underneath from scrolling. Dragging over it moved the background by the better part of a hundred pixels. Closing the drawer then dropped you somewhere you had never been, which reads as the page jumping.",
    "The first fix locked the body. That worked, and it introduced a second, quieter defect: closing the drawer dropped the scroll offset to zero and then took about a second and a half to travel back. Nothing was broken any more — the page just took a scenic route home in front of you.",
  ],

  rootCause: [
    "Locking a page in a browser means taking the document out of the scroll flow, and the only reliable way to do that on mobile Safari is `position: fixed` on the body with a negative `top` equal to the current scroll offset. `overflow: hidden` on the body is quietly ignored there, and a phone is exactly where this bug lives.",
    "But while the body is fixed, the document's own scroll offset is zero. Unlocking therefore has to put it back by hand, with `window.scrollTo`. And `window.scrollTo` is not a jump: it obeys the CSS `scroll-behavior` of the scrolling element. The stylesheet set `scroll-behavior: smooth` on `html` globally, months earlier, for anchor links. The restore inherited it and became an animation.",
    "Returning focus to the hamburger button had the same problem from a different direction. `element.focus()` scrolls the element into view, smoothly, which undoes a restore that has only just landed.",
  ],

  whyFirstFixFailed: [
    "It did not fail — it was correct, and incomplete. The lock was right; the way out of the lock inherited a global CSS rule nobody was thinking about at the time.",
    "This is the shape most real bugs have. `position: fixed` and `scrollTo` are each individually right, and the seam between them picks up `scroll-behavior: smooth` from a stylesheet written for a completely different reason.",
    "The complete fix is small and fussy: flip the root element's inline `scroll-behavior` to `auto`, restore the position, then put the **previous inline value** back rather than hard-coding `auto` — otherwise every other smooth scroll on the site is permanently disabled by the drawer. And return focus with `preventScroll: true`.",
  ],

  excerpts: [
    {
      caption: "The global rule that turned the restore into an animation",
      kind: "code",
      language: "css",
      origin: "reproduction",
      lines: [
        "html {",
        "  /* Added for anchor links. Nothing to do with the drawer. */",
        "  scroll-behavior: smooth;",
        "}",
      ],
    },
    {
      caption: "Locking the body when the drawer opens",
      kind: "code",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "useEffect(() => {",
        "  if (!open || !narrow) return;",
        "",
        "  const y = window.scrollY;",
        "  const body = document.body;",
        "  const gutter =",
        "    window.innerWidth - document.documentElement.clientWidth;",
        "  const before = { /* every inline style we are about to touch */ };",
        "",
        "  body.style.position = \"fixed\";",
        "  body.style.top = `-${y}px`;",
        "  body.style.left = \"0\";",
        "  body.style.right = \"0\";",
        "  body.style.width = \"100%\";",
        "  if (gutter > 0) body.style.paddingRight = `${gutter}px`;",
      ],
    },
    {
      caption: "The restore, before and after",
      kind: "diff",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "   return () => {",
        "     Object.assign(body.style, before);",
        "     if (!restoreScroll.current) return;",
        "",
        "-    window.scrollTo(0, y);",
        "+    // Jump. Do not take the smooth ride: the inline value only",
        "+    // affects this one call, so the global rule stays in force.",
        "+    const root = document.documentElement;",
        "+    const prevBehavior = root.style.scrollBehavior;",
        "+    root.style.scrollBehavior = \"auto\";",
        "+    window.scrollTo(0, y);",
        "+    root.style.scrollBehavior = prevBehavior;",
        "   };",
      ],
    },
    {
      caption: "And the same problem, via focus",
      kind: "diff",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "   if (e.key === \"Escape\") {",
        "     e.preventDefault();",
        "     setOpen(false);",
        "-    openerRef.current?.focus();",
        "+    // Without preventScroll the browser scrolls the hamburger",
        "+    // into view — smoothly — and undoes the restore.",
        "+    openerRef.current?.focus({ preventScroll: true });",
        "     return;",
        "   }",
      ],
    },
    {
      caption: "components/sims/drawer/drawer-sim.tsx — how the frames are sampled",
      kind: "code",
      language: "tsx",
      origin: "museum-source",
      href: SIMULATION,
      lines: [
        "const sampleFrames = useCallback(() => {",
        "  const vp = viewportRef.current;",
        "  if (!vp) return;",
        "  const seen: number[] = [];",
        "  let n = 0;",
        "  const step = () => {",
        "    seen.push(Math.round(vp.scrollTop));",
        "    n += 1;",
        "    if (n < 5) {",
        "      requestAnimationFrame(step);",
        "    } else {",
        "      setFrames(seen);",
        "    }",
        "  };",
        "  requestAnimationFrame(step);",
        "}, []);",
      ],
    },
  ],

  test: {
    intro: [
      "The interesting problem with testing this is that patience hides it. Wait two seconds after closing the drawer and the animated restore has arrived too — the broken version passes.",
      "So the simulation samples five consecutive `requestAnimationFrame` callbacks after every close and puts the numbers on screen, and the test asserts against the second frame rather than the settled value. In the Fixed state the strip reads the same number five times; in First fix it reads something like `0 → 2 → 6 → 12 → 19`.",
      "A separate test asserts that the phone's scroll container really is in `scroll-behavior: smooth` mode before any of that runs. Without it the whole suite would pass for the wrong reason on a browser that ignores the rule, and the exhibit would be demonstrating nothing.",
      "The rest of the spec attacks the lock directly: wheel events and `scrollTop` writes over the scrim, at 1280px and 390px, and all three ways of closing landing on the same pixel.",
    ],
    excerpt: {
      caption: "tests/e2e/drawer.spec.ts",
      kind: "code",
      language: "ts",
      origin: "museum-source",
      href: E2E,
      lines: [
        "test(\"Fixed: the position is back by the second frame\", async ({",
        "  page,",
        "}) => {",
        "  await selectState(page, /^Fixed$/);",
        "  const y = await scrollToMiddle(page);",
        "  await openDrawer(page);",
        "",
        "  await page.getByRole(\"button\", { name: \"Push the background\" }).click();",
        "  await expect(page.getByText(/the page is locked/)).toBeVisible();",
        "",
        "  await page.getByRole(\"button\", { name: \"Close the drawer\" }).click();",
        "",
        "  const verdict = page.getByTestId(\"frame-verdict\");",
        "  await expect(verdict).toContainText(\"by frame two\");",
        "  await expect(verdict).toContainText(String(y));",
        "",
        "  expect(await scrollTop(page)).toBe(y);",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "The page moved behind the drawer",
      detail:
        "Reported from a phone: open the sidebar halfway down a long page, drag over the scrim, and the page scrolls. The Broken state in the case reproduces it — the readout shows the offset changing while the drawer is open.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "attempted",
      title: "Lock the body with position: fixed",
      detail:
        "`position: fixed` with a negative `top`, not `overflow: hidden`, because mobile Safari ignores the latter on the body. Restore the offset on close, skip the restore when navigating away, and pad for the disappearing scrollbar.",
    },
    {
      phase: "fixed",
      title: "Restore instantly, and give focus back without scrolling",
      detail:
        "Set the root element's inline `scroll-behavior` to `auto` around the `scrollTo`, put the previous inline value back afterwards, and return focus with `preventScroll: true`.",
    },
    {
      phase: "regression-test",
      title: "Sampled frame by frame, at two widths, three ways out",
      detail:
        "The spec refuses to wait for the scroll to settle and asserts on the second frame instead. It also asserts the container is genuinely smooth-scrolling first, so it cannot pass vacuously.",
      source: { kind: "regression-test", label: "tests/e2e/drawer.spec.ts", href: E2E },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/drawer-scroll-lock.ts",
      href: DEFINITION,
      note: "Every word on this page, as data.",
    },
    {
      kind: "simulation",
      label: "components/sims/drawer/drawer-sim.tsx",
      href: SIMULATION,
      note: "All three code paths, and the frame sampler.",
    },
    {
      kind: "simulation-logic",
      label: "components/sims/drawer/drawer.module.css",
      href: CASE_CSS,
      note: "Where the phone's scroll container gets scroll-behavior: smooth.",
    },
    {
      kind: "regression-test",
      label: "tests/e2e/drawer.spec.ts",
      href: E2E,
      note: "22 assertions across two viewport widths.",
    },
  ],

  evidence:
    "Three code paths in one component, switchable above. The difference between the last two is asserted frame by frame rather than after the scroll settles.",
  simulationNote:
    "The phone in the case is a scroll container in this page. It runs all three implementations against an element that really does carry `scroll-behavior: smooth`, so the difference you see between First fix and Fixed is the real mechanism — but the content, the timings and the pixel numbers are this browser's, not a recording of anything.",
};
