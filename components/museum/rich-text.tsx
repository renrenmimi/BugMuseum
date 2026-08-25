import { Fragment, type ReactNode } from "react";

/* `code` and **emphasis**, and nothing else. Exhibit prose is full of
   property names and method calls, and a museum label that reads
   "obeys the CSS `scroll-behavior`" with the backticks showing is a
   worse bug than most of the ones on display here. */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*)/g;

export function RichText({ text }: { text: string }): ReactNode {
  const parts = text.split(TOKEN).filter((part) => part !== "");

  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** The same text with the markers removed, for titles and meta tags. */
export function plainText(text: string): string {
  return text.replace(/`/g, "").replace(/\*\*/g, "");
}
