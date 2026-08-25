"use client";

import { useEffect, useRef } from "react";
import type { LogEntry, LogTone } from "./use-event-log";
import { cx } from "@/lib/cx";
import s from "./sim.module.css";

const TONE_CLASS: Record<LogTone, string | undefined> = {
  neutral: undefined,
  broken: s.logBroken,
  first: s.logFirst,
  fixed: s.logFixed,
};

export function EventLog({
  entries,
  label,
  empty = "Nothing yet — try a control above.",
}: {
  entries: readonly LogEntry[];
  label: string;
  empty?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastId = entries.length > 0 ? entries[entries.length - 1]?.id : undefined;

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lastId]);

  return (
    <div className={s.log} ref={boxRef}>
      {entries.length === 0 ? (
        <p className={s.logEmpty}>{empty}</p>
      ) : (
        <ul className={s.logList} aria-label={label}>
          {entries.map((entry) => (
            <li key={entry.id} className={cx(s.logRow, TONE_CLASS[entry.tone])}>
              <span className={s.logTime}>{entry.stamp}</span>
              <span className={s.logText}>{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
