import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import s from "./sim.module.css";

export type ReadoutTone = "neutral" | "broken" | "first" | "fixed";

const TONE: Record<ReadoutTone, string | undefined> = {
  neutral: undefined,
  broken: s.valBroken,
  first: s.valFirst,
  fixed: s.valFixed,
};

export function Readout({
  name,
  value,
  tone = "neutral",
}: {
  name: string;
  value: ReactNode;
  tone?: ReadoutTone;
}) {
  return (
    <div className={s.readout}>
      <span className={s.readoutKey}>{name}</span>
      <span className={cx(s.readoutVal, TONE[tone])}>{value}</span>
    </div>
  );
}
