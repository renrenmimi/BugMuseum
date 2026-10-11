import { describe, expect, it } from "vitest";
import { exhibits } from "@/content/exhibits";
import { toCard, toStage } from "@/components/museum/exhibit-props";

/* Whatever these return is serialised into the page for the client
   components, so they must stay small: no wall text, no excerpts. */
describe("the props handed to client components", () => {
  it("give a gallery card only what the card renders", () => {
    for (const exhibit of exhibits) {
      expect(Object.keys(toCard(exhibit)).sort()).toEqual([
        "categories",
        "context",
        "number",
        "slug",
        "states",
        "summary",
        "title",
      ]);
      for (const state of toCard(exhibit).states) {
        expect(Object.keys(state).sort()).toEqual(["key", "label"]);
      }
    }
  });

  it("give the case its states and note, and none of the wall text", () => {
    for (const exhibit of exhibits) {
      const sent = JSON.stringify(toStage(exhibit));
      expect(Object.keys(toStage(exhibit)).sort()).toEqual([
        "context",
        "number",
        "simulation",
        "simulationNote",
        "states",
      ]);
      for (const paragraph of [...exhibit.whatHappened, ...exhibit.rootCause]) {
        expect(sent).not.toContain(paragraph);
      }
    }
  });
});
