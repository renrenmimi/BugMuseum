import type { Metadata } from "next";
import Link from "next/link";
import { exhibits } from "@/content/exhibits";
import s from "./about.module.css";

export const metadata: Metadata = {
  title: "About the museum",
  description:
    "What is real and what is simulated in Bug Museum, and the evidence standard every exhibit has to meet.",
  alternates: { canonical: "/about" },
};

const REAL = [
  "The bugs. Every one was reported, reproduced and fixed in a repository of mine that you can open right now.",
  "The code. Excerpts marked “quoted” are copied from the commit they link to, with long lines wrapped and unrelated bodies elided.",
  "The numbers. 88 pixels, 2054.5, 0 → 0 → 1 → 4 → 9, 48 of 64 assertions — these come from the commit messages, which recorded them at the time.",
  "The order of events. Where an exhibit shows a first fix, that fix is a real commit that really shipped before the second one.",
];

const SIMULATED = [
  "The demonstrations. Nothing on this site talks to Firebase, a microphone or an LLM. Each simulation re-implements the mechanism so you can drive it.",
  "The content inside them. The lesson titles in the phone, the drill names, the three fill-in-the-blanks: written for this museum, not scraped from the originals.",
  "The clocks. Time zones, backoffs and 180ms ticks are modelled deterministically so the exhibit behaves the same for every visitor.",
  "Two regression tests. Exhibits 4 and 6 have no upstream test suite; the museum's own tests stand in, and the exhibit says so where the test would be.",
];

const RULES = [
  {
    lead: "A commit, or it did not happen.",
    body: "Every exhibit links to at least one commit or pull request. If I could not point at the change, the bug is not here — several candidates were dropped for exactly that reason.",
  },
  {
    lead: "No composite bugs.",
    body: "Nothing here is two half-remembered incidents merged into a better story. One exhibit, one defect, one fix history.",
  },
  {
    lead: "Say when the test is weak.",
    body: "Two of these six were verified by hand rather than by a test. Those exhibits say so in the section where the test would otherwise be.",
  },
  {
    lead: "Say when the simulation diverges.",
    body: "Every display case carries a note under it explaining what is reproduced rather than run.",
  },
  {
    lead: "The first fix stays in the record.",
    body: "Where a fix was shipped and turned out to be incomplete, it is on the wall next to the final one. That is the interesting part.",
  },
];

export default function AboutPage() {
  const projects = [...new Set(exhibits.map((e) => e.project.repo))];

  return (
    <div className="page">
      <header className={s.head}>
        <p className="label">About</p>
        <h1 className={s.title}>These are my bugs.</h1>
        <p className={s.lede}>
          I kept running into the same shape of problem: the fix is easy to show
          and the reasoning is not. So I collected six defects from{" "}
          {projects.length} of my own projects, rebuilt each one as something you
          can operate, and left the working out attached.
        </p>
      </header>

      <section className={s.section} aria-labelledby="what-heading">
        <div className="section-head">
          <p className="label">Honesty</p>
          <h2 id="what-heading">What is real and what is simulated</h2>
        </div>
        <div className={s.split}>
          <div className={`${s.box} ${s.boxReal}`}>
            <h3 className={s.boxTitle}>Real</h3>
            <ul className={s.list}>
              {REAL.map((line) => (
                <li key={line}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${s.box} ${s.boxSim}`}>
            <h3 className={s.boxTitle}>Simulated</h3>
            <ul className={s.list}>
              {SIMULATED.map((line) => (
                <li key={line}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={s.section} aria-labelledby="standard-heading">
        <div className="section-head">
          <p className="label">Evidence standard</p>
          <h2 id="standard-heading">Five rules I held myself to</h2>
        </div>
        <ol className={s.rules}>
          {RULES.map((rule) => (
            <li key={rule.lead} className={s.rule}>
              <span>
                <strong>{rule.lead}</strong> {rule.body}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={s.section} aria-labelledby="collection-heading">
        <div className="section-head">
          <p className="label">Provenance</p>
          <h2 id="collection-heading">Where the collection came from</h2>
        </div>
        <div className="prose">
          <p>
            {projects.map((repo, i) => (
              <span key={repo}>
                <a href={`https://github.com/${repo}`} rel="noreferrer">
                  {repo}
                </a>
                {i < projects.length - 1 ? ", " : ". "}
              </span>
            ))}
            All four are public, so every claim on this site can be checked
            against the history it came from.
          </p>
          <p>
            The museum itself is{" "}
            <a
              href="https://github.com/renrenmimi/BugMuseum"
              rel="noreferrer"
            >
              open source
            </a>
            . Exhibits are plain data files, which is the only reason six of them
            was practical.
          </p>
          <p>
            No analytics, no cookies, no tracking of any kind. Start at the{" "}
            <Link href="/">gallery</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
