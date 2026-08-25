import type { SourceKind, SourceLink } from "@/content/schema";
import s from "./museum.module.css";

const KIND_LABELS: Record<SourceKind, string> = {
  "pull-request": "Pull request",
  commit: "Commit",
  file: "File",
  repository: "Repository",
};

export function SourceList({ sources }: { sources: readonly SourceLink[] }) {
  return (
    <ul className={s.sources}>
      {sources.map((source) => (
        <li key={source.href + source.label} className={s.source}>
          <span className={s.sourceKind}>{KIND_LABELS[source.kind]}</span>
          <a className={s.sourceLink} href={source.href} rel="noreferrer">
            {source.label} ↗
          </a>
          {source.note ? <span className={s.sourceNote}>{source.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
