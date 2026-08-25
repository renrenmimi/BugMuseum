"use client";

import type { ComponentType } from "react";
import type { SimulationId, StateKey } from "@/content/schema";
import { DrawerSim } from "./drawer/drawer-sim";
import { BreakerSim } from "./breaker/breaker-sim";
import { DaySim } from "./day/day-sim";
import { RecogniserSim } from "./recogniser/recogniser-sim";
import { TabsSim } from "./tabs/tabs-sim";
import { BlanksSim } from "./blanks/blanks-sim";

export interface SimProps {
  state: StateKey;
}

/**
 * One entry per simulation id. Adding an exhibit means adding a component
 * and a line here — nothing else in the application changes.
 */
export const SIM_REGISTRY: Record<SimulationId, ComponentType<SimProps>> = {
  "drawer-scroll-lock": DrawerSim,
  "circuit-breaker": BreakerSim,
  "local-day": DaySim,
  "restart-loop": RecogniserSim,
  "two-tabs": TabsSim,
  "double-submit": BlanksSim,
};
