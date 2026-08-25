"use client";

import { useCallback, useRef, useState } from "react";

export type LogTone = "neutral" | "broken" | "first" | "fixed";

export interface LogEntry {
  id: number;
  /** Free-form: a millisecond count, a step number, a clock reading. */
  stamp: string;
  text: string;
  tone: LogTone;
}

/**
 * Every simulation writes what it did, so a visitor who cannot see motion —
 * or who simply wants the receipts — can read the same story.
 */
export function useEventLog(limit = 60) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  const push = useCallback(
    (stamp: string, text: string, tone: LogTone = "neutral") => {
      nextId.current += 1;
      const entry: LogEntry = { id: nextId.current, stamp, text, tone };
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > limit ? next.slice(next.length - limit) : next;
      });
    },
    [limit],
  );

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, push, clear };
}
