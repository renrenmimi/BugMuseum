import { Fragment, type ReactNode } from "react";

/* `code`, **strong** and *emphasis*, and nothing else. Exhibit prose is
   full of property names and method calls, and a museum label that reads
   "obeys the CSS `scroll-behavior`" with the backticks showing is a
   worse bug than most of the ones on display here.

   Emphasis has to start and end on a non-space character and cannot
   contain a backtick, so "2 * 3" and a lone asterisk are left alone. */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s`](?:[^*`]*[^*\s`])?\*)/g;
const EMPHASIS = /\*([^*\s`](?:[^*`]*[^*\s`])?)\*/g;

export function RichText({ text }: { text: string }): ReactNode {
  /* split() with one capturing group alternates text, token, text, token… */
  const parts = text.split(TOKEN);

  return (
    <>
      {parts.map((part, i) => {
        if (part === "") return null;
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
        if (part.startsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <em key={i}>{part.slice(1, -1)}</em>;
      })}
    </>
  );
}

/** The same text with the markers removed, for titles and meta tags. */
export function plainText(text: string): string {
  return text.replace(/`/g, "").replace(/\*\*/g, "").replace(EMPHASIS, "$1");
}
