import type { SourceLink } from "@/content/schema";
import { SOURCE_KIND_LABELS } from "@/content/schema";
import s from "./museum.module.css";

export function SourceList({ sources }: { sources: readonly SourceLink[] }) {
  return (
    <ul className={s.sources} aria-label="Sources">
      {sources.map((source) => (
        <li key={source.href + source.label} className={s.source}>
          <span className={s.sourceKind}>{SOURCE_KIND_LABELS[source.kind]}</span>
          <a className={s.sourceLink} href={source.href} rel="noreferrer">
            {source.label} ↗
          </a>
          {source.note ? <span className={s.sourceNote}>{source.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
