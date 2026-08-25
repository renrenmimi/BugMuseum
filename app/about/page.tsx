import type { Metadata } from "next";
import Link from "next/link";
import { exhibits } from "@/content/exhibits";
import { MUSEUM_REPO } from "@/content/schema";
import s from "./about.module.css";

export const metadata: Metadata = {
  title: "About the museum",
  description:
    "What is real, what is modelled and what is tested in Bug Museum, why the original project details were removed, and the evidence standard every exhibit has to meet.",
  alternates: { canonical: "/about" },
};

/* Spelled out, because "six cases from 4 settings" reads like a typo. */
const NUMBERS = ["no", "one", "two", "three", "four", "five", "six"] as const;
const spell = (n: number) => NUMBERS[n] ?? String(n);

const REAL = [
  "The debugging cases. Each one is a defect I actually ran into, fixed, and had to explain — including the fixes that were correct and turned out not to be the end of it.",
  "The reasoning. The root cause, the order the fixes happened in, and why the first one was not enough are all accounts of what really occurred.",
  "The tests. Every regression test linked from an exhibit is a test in this repository that runs on every push, and the excerpts marked “from this repository” are copied from it.",
];

const MODELLED = [
  "The demonstrations. Nothing here talks to a server, a microphone or a model API. Each simulation re-implements the mechanism so you can drive it.",
  "The code excerpts. They are minimal reproductions of the pattern being described, written for this museum. They are labelled “minimal reproduction” and are not presented as quotations of anyone's source.",
  "The content inside the simulations: page titles, drill names, the three fill-in-the-blanks. Written here, not lifted from anywhere.",
  "The clocks. Time zones, backoffs and 180ms ticks are modelled deterministically so the exhibit behaves identically for every visitor and on every test runner.",
];

const REMOVED = [
  "The original projects were mine, but they were not the point, and a debugging story does not need a name attached to be useful.",
  "Some of them are still in use, and a museum that walks visitors through their past defects is not a fair way to represent working software.",
  "The technical setting is what a reader needs. “A mobile drawer in a study interface” explains everything the case turns on; the product name explains nothing.",
];

const RULES = [
  {
    lead: "Evidence you can open, or none claimed.",
    body: "Every exhibit links to its own definition, its simulation, and the test that pins it — all in this repository. There are no citations you cannot check, because there are no citations to anywhere else.",
  },
  {
    lead: "No composite cases.",
    body: "Nothing here is two half-remembered incidents merged into a better story. One exhibit, one defect, one fix history.",
  },
  {
    lead: "Say when the evidence is thinner.",
    body: "One case is modelled rather than driven in a real browser, because the API it depends on does not exist in a test environment. Its exhibit says so in the section where the test would otherwise be.",
  },
  {
    lead: "Say when the simulation diverges.",
    body: "Every display case carries a note under it explaining what is reproduced rather than run, including where a delay was shortened to keep the demonstration bearable.",
  },
  {
    lead: "The first fix stays in the record.",
    body: "Where a fix was shipped and turned out to be incomplete, it is on the wall next to the final one. That is the interesting part.",
  },
];

export default function AboutPage() {
  const contexts = exhibits.map((e) => e.context.label);

  return (
    <div className="page">
      <header className={s.head}>
        <p className="label">About</p>
        <h1 className={s.title}>Six bugs, without the name tags.</h1>
        <p className={s.lede}>
          I kept running into the same shape of problem: the fix is easy to show
          and the reasoning is not. So I collected {spell(exhibits.length)} defects
          from my own project work, rebuilt each one as something you can operate,
          and left the working out attached.
        </p>
        <p className={s.lede}>
          Based on bugs encountered during real project work. Identifying project
          details have been changed, and each behaviour is reproduced here as a
          deterministic simulation.
        </p>
      </header>

      <section className={s.section} aria-labelledby="what-heading">
        <div className="section-head">
          <p className="label">Honesty</p>
          <h2 id="what-heading">What is real and what is modelled</h2>
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
            <h3 className={s.boxTitle}>Modelled</h3>
            <ul className={s.list}>
              {MODELLED.map((line) => (
                <li key={line}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={s.section} aria-labelledby="anon-heading">
        <div className="section-head">
          <p className="label">Anonymised on purpose</p>
          <h2 id="anon-heading">Why there are no project names here</h2>
        </div>
        <ul className={s.list}>
          {REMOVED.map((line) => (
            <li key={line}>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="prose" style={{ marginTop: "var(--s-4)" }}>
          <p>
            So each exhibit is labelled by its technical setting instead:{" "}
            {contexts.map((label, i) => (
              <span key={label}>
                <em>{label}</em>
                {i < contexts.length - 2 ? ", " : ""}
                {i === contexts.length - 2 ? " and " : ""}
                {i === contexts.length - 1 ? "." : ""}
              </span>
            ))}{" "}
            Those are descriptions, not products. None of them is the name of an
            application, here or anywhere else.
          </p>
        </div>
      </section>

      <section className={s.section} aria-labelledby="standard-heading">
        <div className="section-head">
          <p className="label">Evidence standard</p>
          <h2 id="standard-heading">
            {spell(RULES.length)} rules I held myself to
          </h2>
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
          <p className="label">This site</p>
          <h2 id="collection-heading">How it is put together</h2>
        </div>
        <div className="prose">
          <p>
            Exhibits are plain data files, one per case, validated on every test
            run — a link that points outside this repository fails the build, and
            so does an excerpt that claims to be quoted without saying from where.
          </p>
          <p>
            The museum is{" "}
            <a href={MUSEUM_REPO} rel="noreferrer">
              open source
            </a>
            , so every claim on this site can be checked against the file that
            makes it.
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
