"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StateKey } from "@/content/schema";
import { EventLog } from "../event-log";
import { Readout } from "../readout";
import { useEventLog } from "../use-event-log";
import { cx } from "@/lib/cx";
import sim from "../sim.module.css";
import s from "./drawer.module.css";

const PAGES = ["Arrays", "Graphs", "Dynamic programming"] as const;

/* The pages inside the phone. Long enough that "somewhere in the middle" is a
   real place, short enough that they do not cost anything to render. */
const SECTIONS: Record<(typeof PAGES)[number], readonly string[]> = {
  Arrays: [
    "Two pointers, and when they are a lie",
    "Sliding window: the shape of the invariant",
    "Prefix sums you can actually explain",
    "Binary search on the answer",
    "Monotonic stacks in one sitting",
    "Intervals: merge, sweep, count",
    "Kadane, and why it works",
    "Partitioning around a pivot",
    "Cyclic sort for missing numbers",
    "Difference arrays for range updates",
    "Rotating in place without extra space",
    "Walking a matrix in a spiral",
  ],
  Graphs: [
    "Union find without the folklore",
    "Topological order, and cycles",
    "Dijkstra when the weights misbehave",
    "Breadth-first search, level by level",
    "Depth-first search and its stack",
    "Bipartite checks with two colours",
    "Minimum spanning trees, two ways",
    "Negative edges and Bellman–Ford",
    "Strongly connected components",
    "Shortest paths on a grid",
    "Bridges and articulation points",
    "The graph hiding in a word puzzle",
  ],
  "Dynamic programming": [
    "Bitmask DP, honestly",
    "From backtracking to memoisation",
    "Knapsack, the whole family",
    "Longest common subsequence by hand",
    "Edit distance in a table",
    "Coin change, counted two ways",
    "Intervals as subproblems",
    "Digit DP, one place at a time",
    "DP on trees",
    "State machines for buy-and-sell problems",
    "Partitioning into equal sums",
    "Memoisation or tabulation?",
  ],
};

type Mode = StateKey;

const MODE_TONE = { broken: "broken", "first-fix": "first", fixed: "fixed" } as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The restore the visitor is meant to watch: from 0 back to where they were,
 * over 900ms. Under reduced motion it advances in four visible steps instead
 * of gliding — the journey is the content, the smoothness is not.
 */
function animateRestore(
  vp: HTMLElement,
  to: number,
  stepped: boolean,
): () => void {
  const duration = 900;
  const started = performance.now();
  let raf = 0;
  const tick = (t: number) => {
    const linear = Math.min(1, (t - started) / duration);
    const p = stepped ? Math.ceil(linear * 4) / 4 : linear;
    const eased = 1 - Math.pow(1 - p, 3);
    vp.scrollTop = Math.round(to * eased);
    if (linear < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function DrawerSim({ state }: { state: StateKey }) {
  const mode: Mode = state;

  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  /* Whatever had focus when the drawer opened gets it back when it closes. */
  const openerRef = useRef<HTMLElement | null>(null);
  const navigatedRef = useRef(false);
  const wasOpen = useRef(false);

  /* Exactly one place sets this to true: the moment the lock goes on. */
  const restoreScroll = useRef(true);
  const tweenRef = useRef<(() => void) | null>(null);

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<(typeof PAGES)[number]>("Arrays");
  const [scrollTop, setScrollTop] = useState(0);
  const [locked, setLocked] = useState(false);
  const [frames, setFrames] = useState<number[] | null>(null);
  const [lockedAt, setLockedAt] = useState(0);
  const { entries, push, clear } = useEventLog(40);

  const tone = MODE_TONE[mode];

  /* --- switching state resets the object in the case -------------- */
  useEffect(() => {
    tweenRef.current?.();
    tweenRef.current = null;
    setOpen(false);
    setFrames(null);
    setPage("Arrays");
    clear();
    const vp = viewportRef.current;
    if (vp) {
      const prev = vp.style.scrollBehavior;
      vp.style.scrollBehavior = "auto";
      vp.scrollTop = 0;
      vp.style.scrollBehavior = prev;
    }
  }, [mode, clear]);

  /* --- keep the readout honest ------------------------------------ */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onScroll = () => setScrollTop(Math.round(vp.scrollTop));
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => vp.removeEventListener("scroll", onScroll);
  }, []);

  /* --- the lock itself: the three code paths this exhibit is about -- */
  useLayoutEffect(() => {
    if (!open || mode === "broken") return;
    const vp = viewportRef.current;
    const wrap = wrapRef.current;
    const doc = docRef.current;
    if (!vp || !wrap || !doc) return;

    restoreScroll.current = true;
    const y = Math.round(vp.scrollTop);
    setLockedAt(y);
    const before = {
      position: doc.style.position,
      top: doc.style.top,
      left: doc.style.left,
      right: doc.style.right,
    };
    const wrapBefore = { height: wrap.style.height, overflow: wrap.style.overflow };

    doc.style.position = "absolute";
    doc.style.top = `-${y}px`;
    doc.style.left = "0";
    doc.style.right = "0";
    wrap.style.height = `${vp.clientHeight}px`;
    wrap.style.overflow = "hidden";
    setLocked(true);
    push("lock", `body → position: fixed, top: -${y}px`, tone);

    return () => {
      Object.assign(doc.style, before);
      Object.assign(wrap.style, wrapBefore);
      setLocked(false);
      /* Force layout back before asking for a scroll position. */
      void vp.scrollHeight;

      if (!restoreScroll.current) {
        push("close", "navigating away — deliberately not restored", tone);
        return;
      }

      if (mode === "fixed") {
        const prevBehavior = vp.style.scrollBehavior;
        vp.style.scrollBehavior = "auto";
        vp.scrollTo(0, y);
        vp.style.scrollBehavior = prevBehavior;
        push("restore", `scrollBehavior: auto → scrollTo(0, ${y}) → restored`, tone);
        return;
      }

      vp.scrollTo(0, y);
      /* If the browser honoured scroll-behavior: smooth, that call has
         already become an animation and we are done. Headless browsers turn
         it into a jump, and so does the stylesheet under reduced motion —
         drive the same journey by hand there, in steps when motion is
         reduced, or the exhibit shows nothing. */
      const stepped = prefersReducedMotion();
      if (Math.round(vp.scrollTop) === y && y > 0) {
        vp.scrollTop = 0;
        tweenRef.current = animateRestore(vp, y, stepped);
      }
      push(
        "restore",
        `scrollTo(0, ${y}) — governed by scroll-behavior: smooth${
          stepped && y > 0 ? ", shown in four steps because motion is reduced" : ""
        }`,
        tone,
      );
    };
  }, [open, mode, push, tone]);

  /* --- five frames after a close: waiting for the scroll to settle
     is exactly what hides the difference between the last two states -- */
  const sampleFrames = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const seen: number[] = [];
    let n = 0;
    const step = () => {
      seen.push(Math.round(vp.scrollTop));
      n += 1;
      if (n < 5) {
        requestAnimationFrame(step);
      } else {
        setFrames(seen);
      }
    };
    requestAnimationFrame(step);
  }, []);

  const closeDrawer = useCallback(
    (how: string) => {
      if (!open) return;
      push("close", `closed by ${how}`, tone);
      setOpen(false);
      setFrames(null);
      if (mode !== "broken") sampleFrames();
    },
    [open, push, tone, mode, sampleFrames],
  );

  const openDrawer = useCallback(() => {
    tweenRef.current?.();
    tweenRef.current = null;
    const active = document.activeElement;
    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : burgerRef.current;
    setFrames(null);
    setOpen(true);
    push("open", "drawer opened", tone);
  }, [push, tone]);

  /* A stray restore animation must not outlive the case. */
  useEffect(() => () => tweenRef.current?.(), []);

  /* --- Escape --------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    const panel = drawerRef.current;
    panel?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeDrawer("Escape");
    };

    /* Document level, not panel level: Escape has to work from the controls
       beside the case as well as from inside the drawer. */
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeDrawer]);

  /* --- focus back where it came from, however the drawer closed ----- */
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;

    const navigated = navigatedRef.current;
    navigatedRef.current = false;
    /* If the control that closed it is still there and usable (the
       hamburger, the button beside the case), focus is already right. It
       is lost when it was inside the drawer, on the scrim, or on a control
       that closing has just disabled. */
    const active = document.activeElement as HTMLButtonElement | null;
    const lost = !active || active === document.body || active.disabled === true;
    if (!lost && !navigated) return;

    /* A new page starts at the top, so its first control gets focus;
       otherwise whatever opened the drawer does. preventScroll for the same
       reason the restore is instant: focus() otherwise scrolls the target
       into view, smoothly. */
    const target = navigated ? burgerRef.current : (openerRef.current ?? burgerRef.current);
    target?.focus({ preventScroll: true });
  }, [open]);

  /* --- the scrim stops clicks, not scrolling ----------------------- */
  useEffect(() => {
    if (!open) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const nudge = (dy: number) => {
      const before = vp.scrollTop;
      vp.scrollTop = before + dy;
      return Math.round(vp.scrollTop) !== Math.round(before);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      nudge(e.deltaY);
    };

    let lastY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined || lastY === null) return;
      e.preventDefault();
      nudge(lastY - y);
      lastY = y;
    };

    const scrim = scrimRef.current;
    if (!scrim) return;
    scrim.addEventListener("wheel", onWheel, { passive: false });
    scrim.addEventListener("touchstart", onTouchStart, { passive: true });
    scrim.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      scrim.removeEventListener("wheel", onWheel);
      scrim.removeEventListener("touchstart", onTouchStart);
      scrim.removeEventListener("touchmove", onTouchMove);
    };
  }, [open]);

  /* --- the keyboard-reachable version of "drag over the scrim" ----- */
  const pushTheBackground = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const before = Math.round(vp.scrollTop);
    /* Push towards whichever end has room, so that "did not move" can only
       mean the page is locked, never that it was already at the bottom. */
    const room = vp.scrollHeight - vp.clientHeight - vp.scrollTop;
    const prev = vp.style.scrollBehavior;
    vp.style.scrollBehavior = "auto";
    vp.scrollTop = before + (room >= 160 ? 160 : -160);
    vp.style.scrollBehavior = prev;
    const after = Math.round(vp.scrollTop);
    push(
      "probe",
      after === before
        ? `scrollTop stayed at ${before} — the page is locked`
        : `scrollTop moved ${before} → ${after} behind the drawer`,
      after === before ? "fixed" : "broken",
    );
  };

  const scrollToMiddle = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (locked) {
      push("visitor", "tried to jump to the middle — the page is locked, nothing to scroll", tone);
      return;
    }
    tweenRef.current?.();
    tweenRef.current = null;
    const prev = vp.style.scrollBehavior;
    vp.style.scrollBehavior = "auto";
    vp.scrollTop = Math.round((vp.scrollHeight - vp.clientHeight) / 2);
    vp.style.scrollBehavior = prev;
    setScrollTop(Math.round(vp.scrollTop));
    push("visitor", `jumped to the middle (${Math.round(vp.scrollTop)}px)`);
  };

  const navigate = (to: (typeof PAGES)[number]) => {
    /* A new page starts at the top: mark "do not restore" before closing. */
    restoreScroll.current = false;
    navigatedRef.current = true;
    setPage(to);
    setOpen(false);
    setFrames(null);
    push("nav", `followed a link to ${to}`, tone);
    const vp = viewportRef.current;
    if (vp) {
      requestAnimationFrame(() => {
        const prev = vp.style.scrollBehavior;
        vp.style.scrollBehavior = "auto";
        vp.scrollTop = 0;
        vp.style.scrollBehavior = prev;
        setScrollTop(0);
      });
    }
  };

  const target = lockedAt;
  const restored = frames !== null && frames[1] === target;

  return (
    <div className={s.stage}>
      <div className={s.deviceCol}>
        <div className={s.phone}>
          <div className={s.screen}>
            <div className={s.viewport} ref={viewportRef}>
              <div className={s.docWrap} ref={wrapRef}>
                <div className={s.doc} ref={docRef}>
                  <div className={s.topbar}>
                    <button
                      type="button"
                      ref={burgerRef}
                      data-testid="phone-burger"
                      className={s.burger}
                      aria-expanded={open}
                      aria-label={open ? "Close navigation" : "Open navigation"}
                      onClick={() =>
                        open ? closeDrawer("the hamburger") : openDrawer()
                      }
                    >
                      <span />
                      <span />
                      <span />
                    </button>
                    <span className={s.topTitle}>{page}</span>
                  </div>

                  <div className={s.docBody}>
                    {SECTIONS[page].map((title, i) => (
                      <div className={s.block} key={title}>
                        <p className={s.blockNum}>
                          {page} · {String(i + 1).padStart(2, "0")}
                        </p>
                        <p className={s.blockTitle}>{title}</p>
                        <div className={s.bar} />
                        <div className={cx(s.bar, s.barShort)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {open ? (
              <>
                <button
                  type="button"
                  ref={scrimRef}
                  data-testid="drawer-scrim"
                  className={s.scrim}
                  aria-label="Close navigation"
                  onClick={() => closeDrawer("the scrim")}
                />
                <div
                  className={s.drawer}
                  ref={drawerRef}
                  role="dialog"
                  aria-label="Navigation"
                  tabIndex={-1}
                >
                  <p className={s.drawerHead}>Tracks</p>
                  {PAGES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={s.navItem}
                      aria-current={p === page}
                      onClick={() => navigate(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <div className={s.drawerClose}>
                    <button
                      type="button"
                      className={s.navItem}
                      onClick={() => closeDrawer("the drawer button")}
                    >
                      Close (Esc)
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <p className={sim.hint}>
          Scroll the phone with the wheel, a finger, or the controls next to it.
        </p>
      </div>

      <div className={s.sideCol}>
        <div className={sim.controls}>
          <button type="button" className={sim.btn} onClick={scrollToMiddle}>
            Scroll to the middle
          </button>
          <button
            type="button"
            className={cx(sim.btn, !open && sim.btnPrimary)}
            onClick={() => (open ? closeDrawer("the button") : openDrawer())}
          >
            {open ? "Close the drawer" : "Open the drawer"}
          </button>
          <button
            type="button"
            className={sim.btn}
            onClick={pushTheBackground}
            disabled={!open}
          >
            Push the background
          </button>
        </div>

        <div className={sim.readouts}>
          <Readout name="scrollTop" value={`${scrollTop}px`} />
          <Readout
            name="body"
            value={locked ? "position: fixed" : "static"}
            tone={locked ? tone : "neutral"}
          />
          <Readout name="drawer" value={open ? "open" : "closed"} />
        </div>

        <div>
          <p className="label" style={{ marginBottom: "var(--s-2)" }}>
            Five frames after the close
          </p>
          {frames === null ? (
            <p className={sim.hint}>
              Close the drawer from somewhere in the middle to sample them.
            </p>
          ) : (
            <>
              <p className={s.frames}>
                {frames.map((f, i) => (
                  <span key={i}>
                    {i > 0 ? <span className={s.frameArrow}>→ </span> : null}
                    <span
                      className={cx(
                        s.frame,
                        f === target ? s.frameOn : s.frameOff,
                      )}
                    >
                      {f}
                    </span>{" "}
                  </span>
                ))}
              </p>
              <p className={sim.hint} data-testid="frame-verdict">
                {restored
                  ? `Back at ${target}px by frame two. Nothing appeared to move.`
                  : `Target was ${target}px. It is still travelling.`}
              </p>
            </>
          )}
        </div>

        <div>
          <p className="label" style={{ marginBottom: "var(--s-2)" }}>
            What the page did
          </p>
          <EventLog entries={entries} label="Drawer simulation event log" />
        </div>
      </div>
    </div>
  );
}
