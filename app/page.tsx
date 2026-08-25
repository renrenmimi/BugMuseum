import Link from "next/link";
import { CATEGORY_LABELS } from "@/content/schema";
import { exhibits, featuredExhibit, usedCategories } from "@/content/exhibits";
import { Gallery } from "@/components/museum/gallery";
import { ExhibitStage } from "@/components/museum/exhibit-stage";
import s from "./home.module.css";

const CLAIMS = [
  {
    lead: "Software rarely goes straight from broken to fixed.",
    body: "Three of the six exhibits here have a middle state — a fix that was shipped, was correct, and was not the end of it.",
  },
  {
    lead: "The first fix can introduce a second, subtler problem.",
    body: "Locking the page behind a drawer worked. It also made closing the drawer take a 1.5-second scenic route back to where you were.",
  },
  {
    lead: "A passing test is not the same as a working system.",
    body: "One exhibit's unit tests stayed green through the entire life of the bug, because they called the method once and the app called it twice.",
  },
];

const VISIT = [
  {
    title: "Switch the state",
    body: "Every case has a Broken / Fixed switch, and three of them have a First fix in between. The object in the case really is running that version of the code.",
  },
  {
    title: "Break it yourself",
    body: "Scroll the phone, fail the requests, press Enter twice. Nothing here is a recording, and nothing runs code you type.",
  },
  {
    title: "Then read the label",
    body: "The explanation, the diff and the regression test are underneath, along with a link to the commit each claim comes from.",
  },
];

export default function HomePage() {
  const featured = featuredExhibit();
  const categories = usedCategories();

  return (
    <div className="page">
      <section className={s.intro}>
        <div>
          <p className="label">A permanent collection of six</p>
          <h1 className={s.title}>
            Real bugs, with the working&nbsp;out left in.
          </h1>
          <p className={s.standfirst}>
            Six defects from four of my own projects. Each one is here as an
            object you can handle: break it, watch the fix land, then read why
            it happened and what stops it coming back.
          </p>
        </div>

        <ul className={s.claims}>
          {CLAIMS.map((claim) => (
            <li key={claim.lead} className={s.claim}>
              <strong>{claim.lead}</strong> {claim.body}
            </li>
          ))}
        </ul>
      </section>

      <section className={s.section} aria-labelledby="featured-heading">
        <div className="section-head">
          <p className="label">Featured exhibit</p>
        </div>

        <div className={s.featured}>
          <div style={{ minWidth: 0 }}>
            <ExhibitStage exhibit={featured} syncHash={false} />
          </div>

          <div className={s.featuredAside}>
            <h2 id="featured-heading" className={s.featuredTitle}>
              <Link href={`/exhibits/${featured.slug}`}>{featured.title}</Link>
            </h2>
            <p className={s.featuredSummary}>{featured.summary}</p>
            <div className={s.meta}>
              <span className={`${s.metaTag} ${s.metaPlain}`}>
                {featured.context.label}
              </span>
              {featured.categories.map((c) => (
                <span key={c} className={s.metaTag}>
                  {CATEGORY_LABELS[c]}
                </span>
              ))}
            </div>
            <Link className={s.cta} href={`/exhibits/${featured.slug}`}>
              Read the whole story
            </Link>
          </div>
        </div>
      </section>

      <section className={s.section} aria-labelledby="gallery-heading">
        <div className="section-head">
          <p className="label">The collection</p>
          <h2 id="gallery-heading">All six exhibits</h2>
        </div>
        <Gallery exhibits={exhibits} categories={categories} />
      </section>

      <section className={s.section} aria-labelledby="visit-heading">
        <div className="section-head">
          <p className="label">How to visit</p>
          <h2 id="visit-heading">Three minutes per room</h2>
        </div>
        <div className={s.visit}>
          {VISIT.map((step) => (
            <div key={step.title} className={s.visitStep}>
              <h3 className={s.visitTitle}>{step.title}</h3>
              <p className={s.visitBody}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
