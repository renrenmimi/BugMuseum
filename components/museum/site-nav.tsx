"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Gallery" },
  { href: "/about", label: "About" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Museum">
      <ul className="site-nav">
        {LINKS.map((link) => {
          /* "page" only for the page itself. An exhibit is inside the
             gallery, so there the link marks the section you are in. */
          const page = pathname === link.href;
          const section =
            link.href === "/"
              ? pathname.startsWith("/exhibits")
              : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={page ? "page" : section ? "true" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
