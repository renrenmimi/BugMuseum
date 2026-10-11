# Changelog

## 2026-10-11 — audit fixes

An audit of the museum covered bugs, UI and UX, accessibility, performance and
the exhibits' teaching content. Each fix below is its own pull request, and all
are merged into `main`.

### Simulation bugs

- Exhibit 06: restart and unmount now behave as each handler would. The fix
  cancels the advance it holds; the broken handler never kept a timer id, so
  every queued advance still fires, and the case says so. A later single Enter
  is no longer drawn as a skipped blank, extra advances cannot run past the last
  blank, an empty submit is no longer logged as the fix's guard, and the Reveal
  control the hint mentions exists ([#10]).
- Exhibit 01: the "Push the background" probe no longer reports a lock in the
  Broken state when the page is simply at its end ([#17]).
- Exhibits 02, 04 and 05: readouts agree with the verdicts beside them —
  failure counts past the threshold, "next probe", the transcript, the
  deliberate restart and the language toggle that rewrote history ([#23]).
- An exhibit's state follows the URL fragment when it changes after load
  ([#20]).

### Teaching content

- Exhibit 04: the root cause no longer teaches the opposite of React's
  dependency-array rule ([#14]).
- Exhibit 06: the reason a ref guards the advance is stated correctly, and an
  unrelated second symptom is removed ([#16]).
- Exhibit 03: the defect counts a five-day streak as four rather than
  "breaking" it, the timing details are corrected, and the headlines hold in
  both clock-change scenarios ([#12]).
- Exhibit 05: the story, the code and the case agree on which tab rebuilt the
  account and what each fix changed ([#15]).
- Exhibit 01: the test excerpt is copied verbatim from its spec, the mobile
  Safari claim is hedged, and `scroll-behavior` is no longer called "inherited"
  ([#9]).
- Exhibit 02: the explanation of the negative assertion and several counts are
  corrected ([#11]).
- The README, `/about` and the gallery say how strong each exhibit's evidence
  is, instead of singling out one exhibit ([#18]).
- Single-asterisk emphasis renders as emphasis instead of showing the asterisks
  ([#8]).

### Provenance

- Every minimal reproduction is rewritten for the museum, with new identifiers
  and comments. Identifiers, simulation strings and an exercise that matched
  the original code are replaced ([#9], [#10], [#11], [#12], [#14], [#15],
  [#16], [#24]). "Adding an exhibit" now requires this, and the share image no
  longer says how many projects the defects came from ([#18]).

### Accessibility

- The drawer gives focus back to whatever opened it, however it is closed, and
  is no longer marked `aria-modal`. Under reduced motion its First fix restore
  takes a few visible steps instead of gliding ([#17]).
- Buttons that disable themselves at the end of a sequence hand focus on
  instead of dropping it ([#10], [#23]).
- Tinted text clears WCAG AA and the answer box's border clears 3:1; the
  contrast test now measures translucent tints over their surfaces ([#24]).
- Event logs, verdicts and frames are announced to screen readers; the day
  slider says the time and date; the gallery filters, card dots and header
  link carry the right roles and state ([#23], [#24]).

### Layout

- Code excerpts use the full column, and on phones they wrap with a hanging
  indent instead of running out of sight ([#13]).
- On phones the featured exhibit's title comes before its case ([#20]).

### Performance

- Client components receive only the fields they render, so the home page no
  longer carries all six exhibits' wall text. On production its document went
  from 26.9 to 9.2 kB transferred (98.4 to 41.1 kB decoded), and the home
  payload that every page prefetches from 22.4 to 5.2 kB ([#20]).
- Each exhibit page loads only its own simulation: 3.2–5.6 kB instead of one
  17.0 kB chunk holding all six ([#21]).
- Together, an exhibit page now transfers 155–160 kB instead of 182–185 kB, and
  `/about` 137 kB instead of 171 kB (production, phone viewport, cache
  disabled).

### Metadata

- Every exhibit page and `/about` has its own share tags with the site
  picture; the 404 page has its own title and a single `noindex` ([#22]).

### Tests

- Excerpts marked "from this repository" must match their files line by line,
  and rendered prose may not contain leftover markup or straight quotes
  ([#19]). The console check listens long enough to see late messages
  ([#22]). Unit tests went from 162 to 220 and end-to-end tests from 166 to
  212.

### Security and licence

- Advisories in Next.js, sharp, undici, source-map-js and brace-expansion are
  patched ([#7]).
- The MIT licence is withdrawn: the source is public to read, not licensed for
  reuse ([#6]).

### Documentation

- The README matches the site again, and both screenshots are retaken
  ([#25], [#26]).

### Not changed

- Switching an exhibit's state still re-requests the site icon. That is
  framework behaviour, and a cache header could not be verified on the
  protected preview.
- The drawer's frame sampler does not cancel its animation frames on unmount:
  the exhibit quotes it verbatim, and it stops by itself after five frames.
- Chrome's notice that a prefetched route's stylesheet has not been used yet
  is accepted; the console check names it as the one expected message.
- The exhibit categories stay as they are.
- Five high advisories remain in `eslint-config-next`'s dev-only dependency
  chain. The only fix npm offers is a downgrade to version 14.

[#6]: https://github.com/renrenmimi/BugMuseum/pull/6
[#7]: https://github.com/renrenmimi/BugMuseum/pull/7
[#8]: https://github.com/renrenmimi/BugMuseum/pull/8
[#9]: https://github.com/renrenmimi/BugMuseum/pull/9
[#10]: https://github.com/renrenmimi/BugMuseum/pull/10
[#11]: https://github.com/renrenmimi/BugMuseum/pull/11
[#12]: https://github.com/renrenmimi/BugMuseum/pull/12
[#13]: https://github.com/renrenmimi/BugMuseum/pull/13
[#14]: https://github.com/renrenmimi/BugMuseum/pull/14
[#15]: https://github.com/renrenmimi/BugMuseum/pull/15
[#16]: https://github.com/renrenmimi/BugMuseum/pull/16
[#17]: https://github.com/renrenmimi/BugMuseum/pull/17
[#18]: https://github.com/renrenmimi/BugMuseum/pull/18
[#19]: https://github.com/renrenmimi/BugMuseum/pull/19
[#20]: https://github.com/renrenmimi/BugMuseum/pull/20
[#21]: https://github.com/renrenmimi/BugMuseum/pull/21
[#22]: https://github.com/renrenmimi/BugMuseum/pull/22
[#23]: https://github.com/renrenmimi/BugMuseum/pull/23
[#24]: https://github.com/renrenmimi/BugMuseum/pull/24
[#25]: https://github.com/renrenmimi/BugMuseum/pull/25
[#26]: https://github.com/renrenmimi/BugMuseum/pull/26
