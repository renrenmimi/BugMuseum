import type { Exhibit, ExhibitContext, ExhibitStateCard } from "@/content/schema";

/* ============================================================
   What the client components are given. A server component passing
   a whole Exhibit to a "use client" component serialises all of it
   into the page — every paragraph of wall text, every excerpt — even
   though the markup for that text is already in the HTML. These
   shapes are the fields each client component actually renders, and
   the mappers below build fresh objects so nothing else rides along.
   ============================================================ */

/** A gallery card: enough to name the exhibit, filter it and link to it. */
export type CardExhibit = Pick<Exhibit, "slug" | "number" | "title" | "summary" | "categories"> & {
  context: Pick<ExhibitContext, "label">;
  states: readonly Pick<ExhibitStateCard, "key" | "label">[];
};

/** The case and its state switch: the simulation, its note and the wall labels. */
export type StageExhibit = Pick<Exhibit, "number" | "simulation" | "simulationNote" | "states"> & {
  context: Pick<ExhibitContext, "label">;
};

export function toCard(exhibit: Exhibit): CardExhibit {
  return {
    slug: exhibit.slug,
    number: exhibit.number,
    title: exhibit.title,
    summary: exhibit.summary,
    categories: exhibit.categories,
    context: { label: exhibit.context.label },
    states: exhibit.states.map(({ key, label }) => ({ key, label })),
  };
}

export function toStage(exhibit: Exhibit): StageExhibit {
  return {
    number: exhibit.number,
    simulation: exhibit.simulation,
    simulationNote: exhibit.simulationNote,
    states: exhibit.states,
    context: { label: exhibit.context.label },
  };
}
