/* ============================================================
   Two tabs, one account, and a listener that thinks a deleted
   profile is a damaged one.

   This is a scripted model of a sequence, not a database client.
   The frames are hand-written so a visitor can stop between any
   two events; the invariants at the end of each script are
   asserted in tests/unit/sims/two-tabs.test.ts.
   ============================================================ */

export type TabsVersion = "broken" | "first-fix" | "fixed";

export interface ServerState {
  userDoc: "live" | "pending" | "deleted" | "recreated";
  usernameReservation: boolean;
  tombstone: boolean;
}

export interface TabState {
  /** What the tab shows in its header. */
  profile: string | null;
  signedIn: boolean;
  /** In-memory caches the app keeps beside the profile. */
  caches: { profile: boolean; content: boolean; users: boolean };
  repairCalls: number;
}

export interface Frame {
  actor: "Tab A" | "Tab B" | "Server";
  event: string;
  detail: string;
  tone: "neutral" | "broken" | "first" | "fixed";
  server: ServerState;
  tabA: TabState;
  tabB: TabState;
}

const LIVE_TAB = (name: string | null = "casey"): TabState => ({
  profile: name,
  signedIn: true,
  caches: { profile: true, content: true, users: true },
  repairCalls: 0,
});

const OUT: TabState = {
  profile: null,
  signedIn: false,
  caches: { profile: false, content: false, users: false },
  repairCalls: 0,
};

interface Draft {
  actor: Frame["actor"];
  event: string;
  detail: string;
  tone?: Frame["tone"];
  server?: Partial<ServerState>;
  tabA?: Partial<TabState>;
  tabB?: Partial<TabState>;
}

function build(drafts: Draft[]): Frame[] {
  let server: ServerState = {
    userDoc: "live",
    usernameReservation: true,
    tombstone: false,
  };
  let tabA = LIVE_TAB();
  let tabB = LIVE_TAB();
  const frames: Frame[] = [];

  for (const d of drafts) {
    server = { ...server, ...d.server };
    tabA = { ...tabA, ...d.tabA, caches: { ...tabA.caches, ...d.tabA?.caches } };
    tabB = { ...tabB, ...d.tabB, caches: { ...tabB.caches, ...d.tabB?.caches } };
    frames.push({
      actor: d.actor,
      event: d.event,
      detail: d.detail,
      tone: d.tone ?? "neutral",
      server: { ...server },
      tabA: { ...tabA, caches: { ...tabA.caches } },
      tabB: { ...tabB, caches: { ...tabB.caches } },
    });
  }

  return frames;
}

const OPENING: Draft[] = [
  {
    actor: "Tab B",
    event: "listener attached to users/{uid}",
    detail:
      "The feed tab has been open for an hour, listening to the same user document as everything else.",
  },
  {
    actor: "Tab A",
    event: "Delete my account",
    detail: "The settings tab calls the account-deletion endpoint.",
  },
];

const BROKEN = build([
  ...OPENING,
  {
    actor: "Server",
    event: "cascade blanks the profile",
    detail:
      "displayName and avatarUrl are cleared on the way down, before the document itself is removed.",
    tabA: { profile: "" },
    tabB: { profile: "" },
  },
  {
    actor: "Tab B",
    event: "snapshot: displayName is empty",
    detail:
      "The repair check passes, so the listener calls the create endpoint to put the missing fields back.",
    tone: "broken",
    tabB: { repairCalls: 1 },
  },
  {
    actor: "Server",
    event: "users/{uid} deleted",
    detail: "The cascade removes the document and the username reservation.",
    server: { userDoc: "deleted", usernameReservation: false },
  },
  {
    actor: "Tab B",
    event: "snapshot: the document is gone",
    detail:
      "The same repair path runs again — a missing document reads as a half-finished signup.",
    tone: "broken",
    tabB: { repairCalls: 2 },
  },
  {
    actor: "Server",
    event: "ensureUserProfile recreates the account",
    detail:
      "The endpoint does exactly what it was asked to: the user document and the username reservation are back.",
    tone: "broken",
    server: { userDoc: "recreated", usernameReservation: true },
    tabB: { profile: "mochi" },
  },
  {
    actor: "Tab A",
    event: "“Your account has been deleted.”",
    detail:
      "Both tabs are still signed in to an account that the backend deleted and the frontend rebuilt.",
    tone: "broken",
    tabA: { profile: "mochi" },
  },
]);

const FIRST_FIX = build([
  ...OPENING,
  {
    actor: "Server",
    event: "tombstone written first",
    detail:
      "The tombstone record is written before anything is removed, so the profile endpoints can refuse.",
    tone: "first",
    server: { tombstone: true },
  },
  {
    actor: "Server",
    event: "deletionPending: true, and the profile is blanked",
    detail:
      "The intent reaches every listening tab through the snapshot stream they are already subscribed to.",
    server: { userDoc: "pending" },
    tabA: { profile: "" },
    tabB: { profile: "" },
  },
  {
    actor: "Tab B",
    event: "snapshot: displayName is empty",
    detail:
      "The first fix only guards the !exists() branch, so the blanked-field path still fires a repair — the server refuses it, but the tab tried.",
    tone: "first",
    tabB: { repairCalls: 1 },
  },
  {
    actor: "Server",
    event: "users/{uid} deleted",
    detail: "The document and the username reservation are removed for good.",
    server: { userDoc: "deleted", usernameReservation: false },
  },
  {
    actor: "Tab B",
    event: "deletion observed — signing out",
    detail:
      "The guard holds: no repair, no resurrection. The tab signs out and the listener detaches.",
    tone: "first",
    tabB: { signedIn: false, profile: null },
  },
  {
    actor: "Tab B",
    event: "…still holding three caches",
    detail:
      "Signing out through this branch skipped the cache clearing the normal path does. The content list and user cache belong to an account that no longer exists.",
    tone: "first",
  },
]);

const FIXED = build([
  ...OPENING,
  {
    actor: "Server",
    event: "tombstone written first",
    detail:
      "The create and update endpoints both refuse while the tombstone exists.",
    tone: "fixed",
    server: { tombstone: true },
  },
  {
    actor: "Server",
    event: "deletionPending: true, and the profile is blanked",
    detail: "Same cascade, same order.",
    server: { userDoc: "pending" },
    tabA: { profile: "" },
    tabB: { profile: "" },
  },
  {
    actor: "Tab B",
    event: "deletionPending seen — return early",
    detail:
      "The listener records the intent and returns before any repair check runs, so the blanked display name never triggers a call.",
    tone: "fixed",
  },
  {
    actor: "Server",
    event: "users/{uid} deleted",
    detail: "Document and username reservation removed.",
    server: { userDoc: "deleted", usernameReservation: false },
  },
  {
    actor: "Tab B",
    event: "sign out, and drop everything",
    detail:
      "All three cache-clearing calls run on the way out, mirroring the normal sign-out path.",
    tone: "fixed",
    tabB: {
      signedIn: false,
      profile: null,
      caches: { profile: false, content: false, users: false },
    },
  },
  {
    actor: "Tab A",
    event: "signed out, account gone",
    detail: "Nothing left to resurrect, in either tab, and nothing stale in memory.",
    tone: "fixed",
    tabA: OUT,
  },
]);

export const TAB_SCRIPTS: Record<TabsVersion, readonly Frame[]> = {
  broken: BROKEN,
  "first-fix": FIRST_FIX,
  fixed: FIXED,
};
