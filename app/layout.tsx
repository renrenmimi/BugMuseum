import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "../styles/base.css";
import "../styles/layout.css";
import { SiteNav } from "@/components/museum/site-nav";

const SITE_URL = "https://bugmuseum.vercel.app";
const DESCRIPTION =
  "An interactive museum of real bugs from my own projects — the broken behaviour, the fix that was not quite enough, the root cause, and the test that keeps it from coming back.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bug Museum — real bugs, with the working out left in",
    template: "%s — Bug Museum",
  },
  description: DESCRIPTION,
  applicationName: "Bug Museum",
  authors: [{ name: "Weiren Feng", url: "https://github.com/renrenmimi" }],
  creator: "Weiren Feng",
  keywords: [
    "debugging",
    "software bugs",
    "root cause analysis",
    "regression tests",
    "React",
    "TypeScript",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Bug Museum",
    title: "Bug Museum — real bugs, with the working out left in",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bug Museum — real bugs, with the working out left in",
    description: DESCRIPTION,
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#14120f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <a className="skip-link" href="#main">
            Skip to content
          </a>

          <header className="site-head">
            <div className="page site-head__inner">
              <Link href="/" className="brand">
                <span className="brand__mark">Bug Museum</span>
                <span className="brand__sub">Est. 2026</span>
              </Link>
              <SiteNav />
            </div>
          </header>

          <main id="main" className="main">
            {children}
          </main>

          <footer className="site-foot">
            <div className="page site-foot__inner">
              <p>
                Six bugs from four of my own projects. Every claim links to the
                commit it came from.
              </p>
              <p>
                <a
                  href="https://github.com/renrenmimi/BugMuseum"
                  rel="noreferrer"
                >
                  Source on GitHub
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
