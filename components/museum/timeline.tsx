import type { TimelineEntry, TimelinePhase } from "@/content/schema";
import { TIMELINE_PHASE_LABELS } from "@/content/schema";
import { cx } from "@/lib/cx";
import { RichText } from "./rich-text";
import s from "./museum.module.css";

const PHASE_CLASS: Record<TimelinePhase, string | undefined> = {
  discovered: s.tlDiscovered,
  attempted: s.tlAttempted,
  fixed: s.tlFixed,
  "regression-test": s.tlRegression,
};

export function Timeline({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <ol className={s.timeline}>
      {entries.map((entry, i) => (
        <li key={i} className={cx(s.tlItem, PHASE_CLASS[entry.phase])}>
          <p className={s.tlPhase}>{TIMELINE_PHASE_LABELS[entry.phase]}</p>
          <h3 className={s.tlTitle}>{entry.title}</h3>
          <p className={s.tlDetail}>
            <RichText text={entry.detail} />
          </p>
          {entry.source ? (
            <a className={s.tlSource} href={entry.source.href} rel="noreferrer">
              {entry.source.label} ↗
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
