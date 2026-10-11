"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SimulationId, StateKey } from "@/content/schema";

export interface SimProps {
  state: StateKey;
}

/**
 * One entry per simulation id. Adding an exhibit means adding a component
 * and a line here — nothing else in the application changes.
 *
 * Each simulation is its own chunk. An exhibit page needs one of them, so it
 * should not download and parse the other five. They are still rendered on
 * the server (dynamic() keeps SSR on), so every case reads as a document
 * without JavaScript, and the page preloads the one chunk it uses.
 */
export const SIM_REGISTRY: Record<SimulationId, ComponentType<SimProps>> = {
  "drawer-scroll-lock": dynamic(() =>
    import("./drawer/drawer-sim").then((m) => m.DrawerSim),
  ),
  "circuit-breaker": dynamic(() =>
    import("./breaker/breaker-sim").then((m) => m.BreakerSim),
  ),
  "local-day": dynamic(() => import("./day/day-sim").then((m) => m.DaySim)),
  "restart-loop": dynamic(() =>
    import("./recogniser/recogniser-sim").then((m) => m.RecogniserSim),
  ),
  "two-tabs": dynamic(() => import("./tabs/tabs-sim").then((m) => m.TabsSim)),
  "double-submit": dynamic(() =>
    import("./blanks/blanks-sim").then((m) => m.BlanksSim),
  ),
};
