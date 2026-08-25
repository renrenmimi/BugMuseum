import type { Category, Exhibit } from "../schema";
import { drawerScrollLock } from "./drawer-scroll-lock";
import { circuitBreakerHalfOpen } from "./circuit-breaker-half-open";
import { localDayBoundary } from "./local-day-boundary";
import { speechRestartLoop } from "./speech-restart-loop";
import { deletedAccountResurrection } from "./deleted-account-resurrection";
import { doubleSubmitSkippedBlank } from "./double-submit-skipped-blank";

/** Gallery order. This is the order visitors walk the rooms in. */
export const exhibits: readonly Exhibit[] = [
  drawerScrollLock,
  circuitBreakerHalfOpen,
  localDayBoundary,
  speechRestartLoop,
  deletedAccountResurrection,
  doubleSubmitSkippedBlank,
];

export function getExhibit(slug: string): Exhibit | undefined {
  return exhibits.find((e) => e.slug === slug);
}

export function featuredExhibit(): Exhibit {
  const found = exhibits.find((e) => e.featured);
  if (!found) throw new Error("No featured exhibit — see validateGallery()");
  return found;
}

/** Previous / next, without wrapping: a gallery has a first and a last room. */
export function neighbours(slug: string): {
  previous?: Exhibit;
  next?: Exhibit;
} {
  const i = exhibits.findIndex((e) => e.slug === slug);
  if (i < 0) return {};
  return { previous: exhibits[i - 1], next: exhibits[i + 1] };
}

/** Categories that at least one exhibit actually uses, in gallery order. */
export function usedCategories(): Category[] {
  const seen: Category[] = [];
  for (const e of exhibits) {
    for (const c of e.categories) {
      if (!seen.includes(c)) seen.push(c);
    }
  }
  return seen;
}

export function countByCategory(category: Category): number {
  return exhibits.filter((e) => e.categories.includes(category)).length;
}
