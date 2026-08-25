"use client";

import { useMemo, useState } from "react";
import type { Category, Exhibit } from "@/content/schema";
import { CATEGORY_LABELS } from "@/content/schema";
import { ExhibitCard } from "./exhibit-card";
import s from "./gallery.module.css";

/**
 * Filtering happens in the browser on a list that is already in the HTML, so
 * the gallery is complete and readable with JavaScript switched off — the
 * chips are the enhancement, not the content.
 */
export function Gallery({
  exhibits,
  categories,
}: {
  exhibits: readonly Exhibit[];
  categories: readonly Category[];
}) {
  const [active, setActive] = useState<Category | null>(null);

  const shown = useMemo(
    () =>
      active === null
        ? exhibits
        : exhibits.filter((e) => e.categories.includes(active)),
    [exhibits, active],
  );

  const counts = useMemo(() => {
    const map = new Map<Category, number>();
    for (const c of categories) {
      map.set(c, exhibits.filter((e) => e.categories.includes(c)).length);
    }
    return map;
  }, [exhibits, categories]);

  return (
    <div className={s.wrap}>
      <div className={s.filters}>
        <span className={s.filterLabel} id="filter-label">
          Filter
        </span>
        <button
          type="button"
          className={s.chip}
          aria-pressed={active === null}
          onClick={() => setActive(null)}
        >
          All<span className={s.count}>{exhibits.length}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={s.chip}
            aria-pressed={active === c}
            onClick={() => setActive(active === c ? null : c)}
          >
            {CATEGORY_LABELS[c]}
            <span className={s.count}>{counts.get(c) ?? 0}</span>
          </button>
        ))}
      </div>

      <p className={s.status} role="status">
        Showing {shown.length} of {exhibits.length} exhibits
        {active ? ` in ${CATEGORY_LABELS[active]}` : ""}
      </p>

      {shown.length === 0 ? (
        <p className={s.empty}>Nothing in this room yet.</p>
      ) : (
        <ul className={s.grid}>
          {shown.map((exhibit) => (
            <li key={exhibit.slug}>
              <ExhibitCard exhibit={exhibit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
