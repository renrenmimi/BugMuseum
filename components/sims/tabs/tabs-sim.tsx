"use client";

import { useEffect, useState } from "react";
import type { StateKey } from "@/content/schema";
import { cx } from "@/lib/cx";
import type { ServerState, TabState } from "@/lib/sims/two-tabs";
import { TAB_SCRIPTS } from "@/lib/sims/two-tabs";
import { Readout } from "../readout";
import sim from "../sim.module.css";
import s from "./tabs.module.css";

const ACCOUNT_LABEL: Record<ServerState["userDoc"], string> = {
  live: "live",
  pending: "being deleted",
  deleted: "gone",
  recreated: "resurrected",
};

const DOC_LABEL: Record<ServerState["userDoc"], string> = {
  live: "live",
  pending: "deletionPending",
  deleted: "deleted",
  recreated: "recreated ⚠",
};

function TabPane({
  title,
  role,
  tab,
  active,
}: {
  title: string;
  role: string;
  tab: TabState;
  active: boolean;
}) {
  const caches =
    Number(tab.caches.profile) + Number(tab.caches.pets) + Number(tab.caches.users);
  return (
    <div className={cx(s.pane, active && s.paneActive)}>
      <p className={s.paneHead}>
        <span>{title}</span>
        <span>{role}</span>
      </p>
      <ul className={s.rows}>
        <li className={s.row}>
          <span className={s.rowKey}>signed in</span>
          <span className={cx(s.rowVal, tab.signedIn ? s.on : s.off)}>
            {tab.signedIn ? "yes" : "no"}
          </span>
        </li>
        <li className={s.row}>
          <span className={s.rowKey}>profile</span>
          <span className={s.rowVal}>
            {tab.profile === null ? "—" : tab.profile === "" ? "(blank)" : tab.profile}
          </span>
        </li>
        <li className={s.row}>
          <span className={s.rowKey}>caches held</span>
          <span className={cx(s.rowVal, caches > 0 && !tab.signedIn && s.warn)}>
            {caches}/3
          </span>
        </li>
        <li className={s.row}>
          <span className={s.rowKey}>repair calls</span>
          <span className={cx(s.rowVal, tab.repairCalls > 0 && s.alarm)}>
            {tab.repairCalls}
          </span>
        </li>
      </ul>
    </div>
  );
}

export function TabsSim({ state }: { state: StateKey }) {
  const script = TAB_SCRIPTS[state];
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [state]);

  const frame = script[Math.min(step, script.length - 1)];
  if (!frame) return null;

  const atEnd = step >= script.length - 1;

  return (
    <div className={sim.sim}>
      <div className={sim.controls}>
        <button
          type="button"
          className={sim.btn}
          onClick={() => setStep((n) => Math.max(0, n - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        <button
          type="button"
          className={cx(sim.btn, !atEnd && sim.btnPrimary)}
          onClick={() => setStep((n) => Math.min(script.length - 1, n + 1))}
          disabled={atEnd}
        >
          Next step
        </button>
        <button type="button" className={sim.btn} onClick={() => setStep(0)}>
          Reset
        </button>
        <span className={sim.hint}>
          Step {step + 1} of {script.length}
        </span>
      </div>

      <div className={s.progress} aria-hidden="true">
        {script.map((_, i) => (
          <span key={i} className={cx(s.pip, i <= step && s.pipDone)} />
        ))}
      </div>

      <div
        className={cx(
          s.now,
          frame.tone === "broken" && s.nowBroken,
          frame.tone === "first" && s.nowFirst,
          frame.tone === "fixed" && s.nowFixed,
        )}
        data-testid="tabs-frame"
      >
        <p className={s.nowActor}>{frame.actor}</p>
        <p className={s.nowEvent}>{frame.event}</p>
        <p className={s.nowDetail}>{frame.detail}</p>
      </div>

      <div className={s.grid}>
        <TabPane
          title="Tab A"
          role="Settings"
          tab={frame.tabA}
          active={frame.actor === "Tab A"}
        />
        <TabPane
          title="Tab B"
          role="Feed"
          tab={frame.tabB}
          active={frame.actor === "Tab B"}
        />
        <div className={cx(s.pane, frame.actor === "Server" && s.paneActive)}>
          <p className={s.paneHead}>
            <span>Server</span>
            <span>Firestore</span>
          </p>
          <ul className={s.rows}>
            <li className={s.row}>
              <span className={s.rowKey}>users/{"{uid}"}</span>
              <span
                className={cx(
                  s.rowVal,
                  frame.server.userDoc === "recreated" && s.alarm,
                  frame.server.userDoc === "deleted" && s.on,
                  frame.server.userDoc === "pending" && s.warn,
                )}
              >
                {DOC_LABEL[frame.server.userDoc]}
              </span>
            </li>
            <li className={s.row}>
              <span className={s.rowKey}>username reservation</span>
              <span
                className={cx(s.rowVal, frame.server.usernameReservation ? s.warn : s.on)}
              >
                {frame.server.usernameReservation ? "held" : "released"}
              </span>
            </li>
            <li className={s.row}>
              <span className={s.rowKey}>tombstone</span>
              <span className={cx(s.rowVal, frame.server.tombstone ? s.on : s.off)}>
                {frame.server.tombstone ? "written" : "none"}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className={sim.readouts}>
        <Readout
          name="account"
          value={ACCOUNT_LABEL[frame.server.userDoc]}
          tone={frame.server.userDoc === "recreated" ? "broken" : "neutral"}
        />
        <Readout
          name="repair calls"
          value={frame.tabA.repairCalls + frame.tabB.repairCalls}
          tone={frame.tabA.repairCalls + frame.tabB.repairCalls > 0 ? "broken" : "fixed"}
        />
      </div>
    </div>
  );
}
