import type { Exhibit } from "../schema";

const REPO = "https://github.com/renrenmimi/DrillLab";
const PR = `${REPO}/pull/16`;
const SQUASH = `${REPO}/commit/e5d430d4012c2fea6bf011a5c481d8ff53534b38`;
const FIRST = `${REPO}/commit/37fc4d23fc137e83ad813d1d395aaa6759dc55f0`;
const FINAL = `${REPO}/commit/e91a1e09a736807a6e269ca3e301de3f4a7e43aa`;
const SHELL = `${REPO}/blob/main/components/app-shell.tsx`;
const BASE_CSS = `${REPO}/blob/main/styles/base.css#L11-L15`;

export const drawerScrollLock: Exhibit = {
  slug: "drawer-scroll-lock",
  number: 1,
  title: "The drawer that let the page slide out from under it",
  summary:
    "A mobile navigation drawer left the page behind it scrollable, and the fix for that made the page take a 1.5-second tour back to where it started.",
  featured: true,
  project: {
    name: "DrillLab",
    repo: "renrenmimi/DrillLab",
    href: REPO,
    blurb: "A study site for interview drills, read mostly on a phone.",
  },
  categories: ["browser", "state"],
  tech: ["Next.js", "React", "CSS", "iOS Safari", "Playwright"],
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
    "DrillLab is mostly read on a phone, so under 960px the sidebar becomes a drawer with a translucent scrim behind it. Someone opened the drawer halfway down a long lesson, dragged a finger over the scrim, and the lesson underneath went with it.",
    "A scrim is a click target. It absorbs pointer events, which is why tapping it closes the drawer — but it does not stop the page underneath from scrolling. Measured on a 390px viewport, dragging over the scrim moved the background by about 88 pixels. Closing the drawer then dropped you somewhere you had never been, which reads as the page jumping.",
    "The first fix locked the body. That worked, and it introduced a second, quieter defect: closing the drawer at scroll position 2055 dropped scrollY to 0 and then took roughly 1.5 seconds to travel back to 2054.5. Nothing was broken any more — the page just took a scenic route home in front of you.",
  ],

  rootCause: [
    "Locking a page in a browser means taking the document out of the scroll flow, and the only reliable way to do that on iOS Safari is `position: fixed` on the body with a negative `top` equal to the current scroll offset. `overflow: hidden` on the body is quietly ignored there, and a phone is exactly where this bug lives.",
    "But while the body is fixed, the document's own scroll offset is zero. Unlocking therefore has to put it back by hand, with `window.scrollTo`. And `window.scrollTo` is not a jump: it obeys the CSS `scroll-behavior` of the scrolling element. DrillLab sets `scroll-behavior: smooth` on `html` globally, so the restore became an animation.",
    "Returning focus to the hamburger button had the same problem from a different direction. `element.focus()` scrolls the element into view, smoothly, which undoes a restore that has only just landed.",
  ],

  whyFirstFixFailed: [
    "It did not fail — it was correct, and incomplete. The lock was right; the way out of the lock inherited a global CSS rule nobody was thinking about at the time.",
    "This is the shape most real bugs have. `position: fixed` and `scrollTo` are each individually right, and the seam between them picks up `scroll-behavior: smooth` from a stylesheet written months earlier for a completely different reason.",
    "The real fix is small and fussy: flip the root element's inline `scroll-behavior` to `auto`, restore the position, then put the **previous inline value** back rather than hard-coding `auto` — otherwise every other smooth scroll on the site is permanently disabled by the drawer. And focus with `preventScroll: true`.",
  ],

  excerpts: [
    {
      caption: "styles/base.css — the rule that made the restore an animation",
      kind: "code",
      language: "css",
      verbatim: true,
      href: BASE_CSS,
      lines: [
        "html {",
        "  -webkit-text-size-adjust: 100%;",
        "  scroll-behavior: smooth;",
        "  scroll-padding-top: calc(var(--topbar-h) + 16px);",
        "}",
      ],
    },
    {
      caption: "components/app-shell.tsx — locking the body when the drawer opens",
      kind: "code",
      language: "tsx",
      verbatim: true,
      href: SHELL,
      lines: [
        "useEffect(() => {",
        "  if (!drawer || !narrow) return;",
        "",
        "  restoreScroll.current = true;",
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
      caption: "components/app-shell.tsx — the restore, before and after",
      kind: "diff",
      language: "tsx",
      verbatim: true,
      href: FINAL,
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
      caption: "components/app-shell.tsx — and the same problem, via focus",
      kind: "diff",
      language: "tsx",
      verbatim: true,
      href: FINAL,
      lines: [
        "   if (e.key === \"Escape\") {",
        "     e.preventDefault();",
        "     setDrawer(false);",
        "-    openerRef.current?.focus();",
        "+    // Without preventScroll the browser scrolls the hamburger",
        "+    // into view — smoothly — and undoes the restore.",
        "+    openerRef.current?.focus({ preventScroll: true });",
        "     return;",
        "   }",
      ],
    },
  ],

  test: {
    intro: [
      "Two Playwright probes, both run in each direction: once against the fix, and once with the fix removed to confirm they actually fail.",
      "The first probe locks the page and then attacks it — wheel events, `window.scrollTo`, a drag over the scrim — at 360, 390, 768 and 960px. With the fix, the background does not move and Escape lands on the same pixel. Without it, the background travels from 374 to 1115 and twelve assertions fail.",
      "The second probe is the interesting one. It cannot wait for a smooth scroll to settle, because waiting is exactly what hides the bug: give it two seconds and the broken version arrives too. So it samples five consecutive `requestAnimationFrame` callbacks and asserts the position is already right on the second frame. It also asserts that the computed `scroll-behavior` really is `smooth` before it starts — otherwise the test would pass for the wrong reason on a browser that ignores the rule. Without the fix, the frames read 0 → 0 → 1 → 4 → 9, and 48 of 64 assertions fail.",
      "This museum ships its own version of that probe against the simulation, in tests/e2e/exhibit-drawer.spec.ts.",
    ],
    excerpt: {
      caption: "The frame-sampling assertion (Bug Museum's port of lock2.mjs)",
      kind: "code",
      language: "ts",
      verbatim: false,
      lines: [
        "// Waiting for the scroll to settle is what hides this bug.",
        "// Sample frames instead, and refuse to run at all unless the",
        "// container really is scrolling smoothly.",
        "expect(await computedScrollBehavior(page)).toBe(\"smooth\");",
        "",
        "const frames = await sampleFramesAfterClose(page, 5);",
        "",
        "expect(frames[0]).toBeGreaterThan(target - 4);  // never drops to 0",
        "expect(frames[1]).toBe(target);                 // back by frame two",
        "expect(new Set(frames.slice(1)).size).toBe(1);  // and then still",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "The page moved behind the drawer",
      detail:
        "Reported from a phone: open the sidebar halfway down a lesson, drag over the scrim, and the lesson scrolls. Measured at about 88px on a 390px viewport.",
      source: { kind: "pull-request", label: "DrillLab PR #16", href: PR },
    },
    {
      phase: "attempted",
      title: "Lock the body with position: fixed",
      detail:
        "`position: fixed` with a negative `top`, not `overflow: hidden`, because iOS Safari ignores the latter on the body. Restore the offset on close, skip the restore when navigating away, and pad for the disappearing scrollbar.",
      source: {
        kind: "commit",
        label: "37fc4d2 — lock the page behind the drawer",
        href: FIRST,
      },
    },
    {
      phase: "fixed",
      title: "Restore instantly, and give focus back without scrolling",
      detail:
        "Set the root element's inline `scroll-behavior` to `auto` around the `scrollTo`, put the previous inline value back afterwards, and return focus with `preventScroll: true`.",
      source: {
        kind: "commit",
        label: "e91a1e0 — restore the scroll position instantly",
        href: FINAL,
      },
    },
    {
      phase: "regression-test",
      title: "Four widths, three ways to close, sampled frame by frame",
      detail:
        "360 / 390 / 768 / 960px × Escape, scrim and hamburger. 64 assertions pass; with the fix removed, 48 fail. The probe asserts the page is genuinely in smooth-scrolling mode first, so it cannot pass vacuously.",
      source: { kind: "commit", label: "e5d430d (squash)", href: SQUASH },
    },
  ],

  sources: [
    {
      kind: "pull-request",
      label: "PR #16 — fix(mobile): lock the page behind the drawer",
      href: PR,
      note: "The report, both fixes, and the measured numbers.",
    },
    {
      kind: "commit",
      label: "e5d430d — the squash commit on main",
      href: SQUASH,
    },
    {
      kind: "commit",
      label: "37fc4d2 — the first fix",
      href: FIRST,
      note: "Locks the body. Correct, and not yet enough.",
    },
    {
      kind: "commit",
      label: "e91a1e0 — the second fix",
      href: FINAL,
      note: "Makes the restore instant.",
    },
    { kind: "file", label: "components/app-shell.tsx", href: SHELL },
    {
      kind: "file",
      label: "styles/base.css — scroll-behavior: smooth",
      href: BASE_CSS,
    },
  ],

  evidence:
    "DrillLab PR #16, squashed to e5d430d, with the two fixes as separate commits on the branch.",
  simulationNote:
    "The phone in the case is a scroll container in this page, not DrillLab. It runs the same three implementations against a `scroll-behavior: smooth` element, so the difference you see between First fix and Fixed is the real mechanism — but the content, the 1.5-second duration and the pixel numbers are this browser's, not the ones measured in the report.",
};
