# Bug Museum

An interactive museum of six real bugs from four of my own projects. Each
exhibit lets you reproduce the broken behaviour, switch to the fix, read why it
happened, and see the test that keeps it from coming back.

Live: <https://bugmuseum.vercel.app>

## Why it exists

The fix for a bug is easy to show. The reasoning is not, and the reasoning is
the part that matters when you are deciding whether someone can debug.

So this is not a debugging tutorial and it contains no invented incidents. It
is a collection of things that actually went wrong in code I wrote, presented
with the working out left in — including the fixes that shipped, were correct,
and turned out not to be the end of it.

Three of the six exhibits have a middle state for exactly that reason.

## What is real and what is simulated

**Real**

- The bugs, the fixes, and the order they happened in. Every exhibit links to
  at least one commit or pull request in a public repository.
- Code excerpts marked *quoted* are copied from the linked source, with long
  lines wrapped and unrelated bodies elided.
- The measurements — 88 pixels of background scroll, a restore that crawled
  back to 2054.5 over 1.5 seconds, `0 → 0 → 1 → 4 → 9` frame samples, 48 of 64
  assertions failing — come from the commit messages that recorded them.

**Simulated**

- Every demonstration. Nothing here talks to Firebase, a microphone or an LLM.
  Each simulation re-implements the mechanism so you can drive it yourself.
- The content inside the simulations: lesson titles, drill names, the three
  fill-in-the-blanks. Written for the museum, not scraped from the originals.
- The clocks. Time zones, backoffs and 180ms ticks are modelled
  deterministically so the exhibit behaves the same for every visitor.
- Two regression tests. Exhibits 04 and 06 have no upstream test suite; the
  museum's own tests stand in, and the exhibit page says so where the test
  would otherwise be.

Every display case carries a note explaining what it reproduces rather than
runs. `/about` states the evidence standard in full.

## The collection

| № | Exhibit | Project | States | Evidence |
|---|---------|---------|--------|----------|
| 01 | The drawer that let the page slide out from under it | DrillLab | Broken · First fix · Fixed | [PR #16](https://github.com/renrenmimi/DrillLab/pull/16), squashed to `e5d430d` |
| 02 | The circuit breaker that could never close again | ToneDown | Broken · Fixed | [`ff02395`](https://github.com/renrenmimi/ToneDown/commit/ff02395627af644b5cb54f8affb49f3b8557233b) |
| 03 | The day that was only 23 hours long | ToneDown | Broken · First fix · Fixed | [`82d995c`](https://github.com/renrenmimi/ToneDown/commit/82d995c0b5d50be135d660a71974c05215fdf49e) and [`ff02395`](https://github.com/renrenmimi/ToneDown/commit/ff02395627af644b5cb54f8affb49f3b8557233b) |
| 04 | The effect that stopped what it had just started | ToneDown | Broken · Fixed | [`1bf7f32`](https://github.com/renrenmimi/ToneDown/commit/1bf7f32) |
| 05 | The other tab brought the account back | PetNote | Broken · First fix · Fixed | [PR #144](https://github.com/renrenmimi/PetNote/pull/144), squashed to `dfa599f` |
| 06 | Two presses of Enter, one question you never saw | AgentLab | Broken · Fixed | [`cbe3058`](https://github.com/renrenmimi/AgentLab/commit/cbe3058d6445440d7ebbe5f072028ddc5eea5596) |

## Architecture

```
app/                    routes: gallery, /exhibits/[slug], /about, icon, OG image
components/museum/      reusable furniture — cards, cases, code, timeline, sources
components/sims/        one folder per simulation, each a client component
content/schema.ts       the exhibit model and its validator
content/exhibits/       one file per exhibit, plus the gallery order
lib/sims/               the logic each simulation runs, framework-free and tested
styles/                 tokens.css, base.css, layout.css; everything else is a CSS Module
tests/unit/             Vitest — data validation, simulation logic, components
tests/e2e/              Playwright — against `next start`, never the dev server
```

Everything is statically rendered at build time. There is no database, no API
route and no client-side data fetching; the only JavaScript that ships is the
simulations and the gallery filter.

Content and presentation are deliberately separate: `content/` knows nothing
about React, `components/museum/` knows nothing about any particular bug, and
`lib/sims/` knows nothing about the DOM.

## The exhibit data model

An exhibit is one object, defined in [`content/schema.ts`](content/schema.ts):

```ts
interface Exhibit {
  slug: string;
  number: number;               // gallery number, 1-based
  title: string;
  summary: string;              // exactly one sentence
  project: Project;             // name, repo, href, one-line blurb
  categories: Category[];       // state | async | browser | concurrency | testing
  tech: string[];
  simulation: SimulationId;     // key into components/sims/registry.tsx
  states: ExhibitStateCard[];   // starts with broken, ends with fixed
  whatHappened: string[];
  rootCause: string[];
  whyFirstFixFailed?: string[]; // required exactly when a first-fix state exists
  test: RegressionTest;         // prose + one excerpt
  excerpts: CodeExcerpt[];      // diff or code, each marked verbatim or not
  timeline: TimelineEntry[];    // discovered → attempted → fixed → regression-test
  sources: SourceLink[];
  evidence: string;             // one line naming the artefact that proves it
  simulationNote: string;       // what is reproduced rather than run
}
```

`validateExhibit()` and `validateGallery()` enforce the rules that keep the
collection honest, and `tests/unit/exhibits.test.ts` runs them:

- every source link points at `github.com/renrenmimi`, over https;
- at least one source is a commit or a pull request;
- a `verbatim` excerpt must link to where it was copied from;
- a diff must contain both an added and a removed line;
- a `first-fix` state requires both `whyFirstFixFailed` and an
  `attempted` timeline entry — and vice versa;
- the timeline runs in order and ends with a regression test;
- no code line is wider than 84 characters, because that is where the case
  starts scrolling sideways on a 360px phone;
- exactly one featured exhibit; unique slugs and numbers.

Prose fields support `` `inline code` `` and `**emphasis**`; titles and
summaries do not, because they are rendered as plain text into `<title>` and
`og:description`.

## Adding an exhibit

1. Write `content/exhibits/<slug>.ts`. Copy the closest existing exhibit — the
   validator will tell you what is missing.
2. Add a simulation id to `SIMULATIONS` in `content/schema.ts`, build the
   component under `components/sims/<name>/`, and register it in
   `components/sims/registry.tsx`.
3. Put the logic the simulation runs in `lib/sims/` so it can be tested without
   a DOM, and test both versions of it — including the broken one.
4. Add the exhibit to the array in `content/exhibits/index.ts`.

No page, route or layout work is involved. `npm test` will fail loudly if the
new exhibit breaks any of the rules above.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

## Testing

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm test             # Vitest: 137 tests
npm run build        # static export of every route

npm run e2e:install  # once, downloads Chromium
npm run e2e          # Playwright: 138 tests against `next start`, at 1280px and 390px
```

`npm run verify` runs typecheck, lint, unit tests and the production build in
one go.

Playwright deliberately runs against the production build. Two of the bugs in
this collection are timing bugs, and the dev server is neither the same bundle
nor the same timing.

What the tests actually assert, rather than screenshot:

- **The drawer.** The scroll position is sampled across five consecutive
  `requestAnimationFrame` callbacks after the drawer closes, and the test first
  asserts the container really is in `scroll-behavior: smooth` mode — otherwise
  it would pass for the wrong reason. Waiting for the scroll to settle is what
  hides this bug.
- **Background scroll.** Wheel events over the scrim move the page in the
  broken state and cannot move it in the locked ones; every way of closing
  (Escape, scrim, hamburger) lands on the same pixel.
- **The simulations' logic**, in `lib/sims/`, in both directions: the broken
  breaker is asserted to be permanently stranded, the millisecond streak walk is
  asserted to skip 8 March, the double submit is asserted to queue two timers.
- **Exhibit data**, against the validator.
- **Keyboard**: skip link, roving tabindex on the state selector, arrow-key
  navigation, visible focus rings, the whole drawer demo driven without a mouse.
- **Direct URLs**: every exhibit route, `#broken` / `#first-fix` / `#fixed`
  fragments, a bad fragment falling back, and a 404 for an unknown slug.
- **Overflow**: no element extends past the viewport on any page at 360px.
- **Reduced motion**: transitions are disabled and the restore still reads as a
  journey rather than a glide.
- **No JavaScript**: the gallery and every exhibit page still read as documents.
- **No console errors or hydration warnings** on any route.

`node scripts/screenshots.mjs` writes full-page captures at 1440, 390 and 360px
to `screenshots/` for visual review. Those are for looking at, not asserting on.

## Deployment

Vercel, with the defaults: `next build`, no environment variables, no secrets,
no runtime configuration. Every route is prerendered, including the Open Graph
image, so there is nothing to configure.

The canonical origin is declared in three places — `app/layout.tsx`,
`app/sitemap.ts` and `app/robots.ts` — and it has to be a **project production
domain**, not a deployment alias. Vercel's default Standard Protection exempts
production domains and gates everything else behind a Vercel login, so pointing
`metadataBase` at a mere alias makes `og:image`, `rel="canonical"` and every URL
in `sitemap.xml` resolve to a login redirect while the site itself stays public.
Check it with `curl -s -o /dev/null -w "%{http_code}" <origin>` after any domain
change: 200 is right, 302 means the origin is not a production domain.

## Accessibility

- Semantic landmarks, one `<h1>` per page, headings in order.
- Skip link, visible focus ring on everything focusable, 2px at 2px offset.
- The state selector is a real radio group: one tab stop, arrow keys move
  between options.
- The drawer simulation traps nothing it should not, returns focus to the
  control that opened it, and closes on Escape from anywhere.
- Every simulation writes an event log, so anyone who cannot perceive the
  motion can read what happened instead.
- `prefers-reduced-motion` switches decorative transitions off. The one place
  motion is the content — the drawer's slow restore — becomes a stepped
  restore rather than disappearing.
- Body text is warm off-white on warm off-black. Every ink/surface pair in
  `styles/tokens.css` is measured against WCAG AA by `tests/unit/contrast.test.ts`
  — that check is what caught `--ink-3` at 4.40:1 against the display case.
- No colour is the only carrier of meaning; the three state colours are always
  paired with a label.
- Nothing is hidden behind hover.

## Evidence and source policy

1. **A commit, or it did not happen.** Every exhibit links to at least one
   commit or pull request. Candidates I could not point at were dropped.
2. **No composite bugs.** One exhibit, one defect, one fix history. Nothing here
   is two half-remembered incidents merged into a better story.
3. **Say when the test is weak.** Two of the six were verified by hand rather
   than by a test, and their exhibit pages say so where the test would be.
4. **Say when the simulation diverges.** Every display case carries a note.
5. **The first fix stays in the record.** Where a fix shipped and turned out to
   be incomplete, it is on the wall next to the final one.

No analytics, no cookies, no tracking.

## Licence

MIT. The bugs are mine; you are welcome to them.
