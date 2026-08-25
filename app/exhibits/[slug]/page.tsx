import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABELS } from "@/content/schema";
import { exhibits, getExhibit, neighbours } from "@/content/exhibits";
import { ExhibitStage } from "@/components/museum/exhibit-stage";
import { CodeExcerptBlock } from "@/components/museum/code-excerpt";
import { Timeline } from "@/components/museum/timeline";
import { SourceList } from "@/components/museum/source-list";
import { RichText } from "@/components/museum/rich-text";
import s from "../exhibit.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return exhibits.map((exhibit) => ({ slug: exhibit.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exhibit = getExhibit(slug);
  if (!exhibit) return { title: "Exhibit not found" };

  const title = `${exhibit.title}`;
  return {
    title,
    description: exhibit.summary,
    alternates: { canonical: `/exhibits/${exhibit.slug}` },
    openGraph: {
      type: "article",
      url: `/exhibits/${exhibit.slug}`,
      title: `${title} — Bug Museum`,
      description: exhibit.summary,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Bug Museum`,
      description: exhibit.summary,
    },
  };
}

export default async function ExhibitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exhibit = getExhibit(slug);
  if (!exhibit) notFound();

  const { previous, next } = neighbours(exhibit.slug);
  const number = String(exhibit.number).padStart(2, "0");

  return (
    <article className="page">
      <header className={s.head}>
        <p className={s.crumbs}>
          <Link href="/">Gallery</Link>
          <span aria-hidden="true">/</span>
          <span>Exhibit {number}</span>
        </p>

        <h1 className={s.title}>{exhibit.title}</h1>
        <p className={s.summary}>{exhibit.summary}</p>

        <div className={s.meta}>
          <a
            className={`${s.metaTag} ${s.metaProject} ${s.metaPlain}`}
            href={exhibit.project.href}
            rel="noreferrer"
          >
            {exhibit.project.repo} ↗
          </a>
          {exhibit.categories.map((c) => (
            <span key={c} className={s.metaTag}>
              {CATEGORY_LABELS[c]}
            </span>
          ))}
          {exhibit.tech.map((t) => (
            <span key={t} className={`${s.metaTag} ${s.metaPlain}`}>
              {t}
            </span>
          ))}
        </div>

        <p className={s.evidence}>
          <strong>Evidence.</strong> <RichText text={exhibit.evidence} />{" "}
          {exhibit.project.blurb}
        </p>
      </header>

      <section className={s.section} aria-labelledby="demo-heading">
        <div className="section-head">
          <p className="label">The object</p>
          <h2 id="demo-heading">See it happen</h2>
        </div>
        <ExhibitStage exhibit={exhibit} />
      </section>

      <section className={s.section} aria-labelledby="story-heading">
        <div className="section-head">
          <p className="label">Wall text</p>
          <h2 id="story-heading">What happened</h2>
        </div>
        <div className={s.twoCol}>
          <div className="prose">
            {exhibit.whatHappened.map((para, i) => (
              <p key={i}>
                <RichText text={para} />
              </p>
            ))}
          </div>
          <div>
            <div className="section-head">
              <h3 className="label">Root cause</h3>
            </div>
            <div className="prose">
              {exhibit.rootCause.map((para, i) => (
                <p key={i}>
                  <RichText text={para} />
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {exhibit.whyFirstFixFailed ? (
        <section className={s.section} aria-labelledby="why-heading">
          <div className={s.whyBox}>
            <h2 id="why-heading" className="label">
              Why the first fix was not the end of it
            </h2>
            <div className={s.whyBody}>
              {exhibit.whyFirstFixFailed.map((para, i) => (
                <p key={i}>
                  <RichText text={para} />
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={s.section} aria-labelledby="code-heading">
        <div className="section-head">
          <p className="label">The change</p>
          <h2 id="code-heading">Code</h2>
        </div>
        <div className={s.codeStack}>
          {exhibit.excerpts.map((excerpt) => (
            <CodeExcerptBlock key={excerpt.caption} excerpt={excerpt} />
          ))}
        </div>
      </section>

      <section className={s.section} aria-labelledby="test-heading">
        <div className="section-head">
          <p className="label">The test that catches it</p>
          <h2 id="test-heading">Proof it stays fixed</h2>
        </div>
        <div className={s.testIntro}>
          {exhibit.test.intro.map((para, i) => (
            <p key={i}>
              <RichText text={para} />
            </p>
          ))}
        </div>
        <CodeExcerptBlock excerpt={exhibit.test.excerpt} />
      </section>

      <section className={s.section} aria-labelledby="timeline-heading">
        <div className="section-head">
          <p className="label">How it went</p>
          <h2 id="timeline-heading">Discovery to regression test</h2>
        </div>
        <Timeline entries={exhibit.timeline} />
      </section>

      <section className={s.section} aria-labelledby="sources-heading">
        <div className="section-head">
          <p className="label">Verify it yourself</p>
          <h2 id="sources-heading">Sources</h2>
        </div>
        <SourceList sources={exhibit.sources} />
      </section>

      <nav className={s.nav} aria-label="Exhibits">
        {previous ? (
          <Link className={s.navLink} href={`/exhibits/${previous.slug}`}>
            <span className={s.navDir}>← Previous</span>
            <span className={s.navTitle}>{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            className={`${s.navLink} ${s.navNext}`}
            href={`/exhibits/${next.slug}`}
          >
            <span className={s.navDir}>Next →</span>
            <span className={s.navTitle}>{next.title}</span>
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
