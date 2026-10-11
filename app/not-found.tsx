import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found",
  description: "Nothing has been catalogued at this address.",
  /* Replaces the inherited openGraph, whose url is the home page's. */
  openGraph: { siteName: "Bug Museum", title: "Not found — Bug Museum" },
};

export default function NotFound() {
  return (
    <div className="page">
      <p className="label">404</p>
      <h1 style={{ marginTop: "var(--s-3)" }}>This room is not on the plan.</h1>
      <p
        className="prose"
        style={{ marginTop: "var(--s-4)", fontSize: "var(--t-5)" }}
      >
        Nothing has been catalogued at this address. The{" "}
        <Link href="/">gallery</Link> has all six exhibits.
      </p>
    </div>
  );
}
