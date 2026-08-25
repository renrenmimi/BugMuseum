import Link from "next/link";
import type { Exhibit } from "@/content/schema";
import { CATEGORY_LABELS } from "@/content/schema";
import { cx } from "@/lib/cx";
import s from "./museum.module.css";

const STATE_DOT: Record<string, string | undefined> = {
  broken: s.dotBroken,
  "first-fix": s.dotFirst,
  fixed: s.dotFixed,
};

export function ExhibitCard({ exhibit }: { exhibit: Exhibit }) {
  const number = String(exhibit.number).padStart(2, "0");

  return (
    <article className={s.card}>
      <div className={s.cardTop}>
        <span className={s.cardNumber}>No. {number}</span>
        <span className={s.cardProject}>{exhibit.project.name}</span>
      </div>

      <h3 className={s.cardTitle}>
        <Link href={`/exhibits/${exhibit.slug}`}>{exhibit.title}</Link>
      </h3>

      <p className={s.cardSummary}>{exhibit.summary}</p>

      <div className={s.cardFoot}>
        <span
          className={s.tagStates}
          aria-label={`${exhibit.states.length} states: ${exhibit.states
            .map((st) => st.label)
            .join(", ")}`}
        >
          {exhibit.states.map((st) => (
            <span key={st.key} className={cx(s.dot, STATE_DOT[st.key])} />
          ))}
        </span>
        {exhibit.categories.map((c) => (
          <span key={c} className={s.tag}>
            {CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>
    </article>
  );
}
