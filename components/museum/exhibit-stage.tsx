"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import { SIM_REGISTRY } from "@/components/sims/registry";
import { DisplayCase } from "./display-case";
import type { StageExhibit } from "./exhibit-props";
import { RichText } from "./rich-text";
import s from "./exhibit-stage.module.css";

const TONE: Record<StateKey, string | undefined> = {
  broken: s.broken,
  "first-fix": s.first,
  fixed: s.fixed,
};

const CARD_TONE: Record<StateKey, string | undefined> = {
  broken: s.cardBroken,
  "first-fix": s.cardFirst,
  fixed: s.cardFixed,
};

function readHash(valid: readonly StateKey[]): StateKey | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  return valid.includes(raw as StateKey) ? (raw as StateKey) : null;
}

/**
 * The object in its case, plus the three-way switch above it and the wall
 * label below. The selected state is mirrored into the URL fragment so a
 * particular state is a link you can send someone.
 */
export function ExhibitStage({
  exhibit,
  syncHash = true,
}: {
  exhibit: StageExhibit;
  /** The gallery entrance shows a case too, and should not own the URL. */
  syncHash?: boolean;
}) {
  const keys = exhibit.states.map((st) => st.key);
  const first = keys[0] ?? "broken";
  const [active, setActive] = useState<StateKey>(first);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* The hash is read after mount: rendering from it would disagree with the
     server-rendered HTML, and a hydration warning is a bug in a museum
     about bugs. It is read again whenever it changes, so a fragment edited
     in the address bar, or reached by an in-page link, switches the state. */
  const keyList = keys.join(" ");
  useEffect(() => {
    if (!syncHash) return;
    const valid = keyList.split(" ") as StateKey[];
    const follow = () => {
      const fromHash = readHash(valid);
      if (fromHash) setActive(fromHash);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [syncHash, keyList]);

  const select = useCallback(
    (key: StateKey) => {
      setActive(key);
      if (syncHash && typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${key}`);
      }
    },
    [syncHash],
  );

  /* Arrow keys move between options, as a radio group should. */
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (index + delta + keys.length) % keys.length;
    const key = keys[next];
    if (!key) return;
    select(key);
    buttonRefs.current[next]?.focus();
  };

  const Simulation = SIM_REGISTRY[exhibit.simulation];
  const card = exhibit.states.find((st) => st.key === active) ?? exhibit.states[0];
  if (!card) return null;

  return (
    <div className={s.stage}>
      <div
        className={s.selector}
        role="radiogroup"
        aria-label="Which version of the code is running"
      >
        {exhibit.states.map((st, i) => (
          <button
            key={st.key}
            type="button"
            role="radio"
            aria-checked={st.key === active}
            tabIndex={st.key === active ? 0 : -1}
            ref={(node) => {
              buttonRefs.current[i] = node;
            }}
            className={cx(s.option, TONE[st.key], st.key === active && s.optionOn)}
            onClick={() => select(st.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className={s.optionDot} aria-hidden="true" />
            {st.label}
          </button>
        ))}
      </div>

      <DisplayCase
        label={`Exhibit ${String(exhibit.number).padStart(2, "0")} — ${card.label}`}
        aside={<span className={s.caseProject}>{exhibit.context.label}</span>}
        note={<RichText text={exhibit.simulationNote} />}
      >
        <Simulation key={active} state={active} />
      </DisplayCase>

      <div className={cx(s.card, CARD_TONE[active])}>
        <p className="label">What you are looking at</p>
        <p className={s.headline} data-testid="state-headline">
          <RichText text={card.headline} />
        </p>
        <ul className={s.tryList}>
          {card.tryThis.map((line) => (
            <li key={line}>
              <span>
                <RichText text={line} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
