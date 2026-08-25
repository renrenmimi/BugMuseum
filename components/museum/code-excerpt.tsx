import type { CodeExcerpt } from "@/content/schema";
import { cx } from "@/lib/cx";
import s from "./museum.module.css";

function lineClass(kind: CodeExcerpt["kind"], line: string): string {
  if (kind === "diff") {
    if (line.startsWith("+")) return cx(s.codeLine, s.codeAdd);
    if (line.startsWith("-")) return cx(s.codeLine, s.codeDel);
    return cx(s.codeLine);
  }
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return cx(s.codeLine, s.codeComment);
  }
  return cx(s.codeLine);
}

/**
 * Renders a quoted excerpt. No syntax highlighter: a diff needs three colours
 * and a museum does not need a 200kB tokenizer to show fourteen lines.
 */
export function CodeExcerptBlock({ excerpt }: { excerpt: CodeExcerpt }) {
  return (
    <figure className={s.code}>
      <figcaption className={s.codeHead}>
        <span className={s.codeCaption}>{excerpt.caption}</span>
        <span className={s.codeSource}>
          {excerpt.origin === "museum-source"
            ? "from this repository"
            : "minimal reproduction"}
          {excerpt.href ? (
            <>
              {" · "}
              <a href={excerpt.href} rel="noreferrer">
                source
              </a>
            </>
          ) : null}
        </span>
      </figcaption>
      <pre className={s.codePre}>
        <code>
          {excerpt.lines.map((line, i) => (
            <span key={i} className={lineClass(excerpt.kind, line)}>
              {line === "" ? " " : line}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
