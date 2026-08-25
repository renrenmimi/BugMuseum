import type { Exhibit } from "../schema";
import { MUSEUM_REPO } from "../schema";

const file = (path: string) => `${MUSEUM_REPO}/blob/main/${path}`;

const DEFINITION = file("content/exhibits/deleted-account-resurrection.ts");
const SIMULATION = file("components/sims/tabs/tabs-sim.tsx");
const LOGIC = file("lib/sims/two-tabs.ts");
const UNIT = file("tests/unit/sims/two-tabs.test.ts");

export const deletedAccountResurrection: Exhibit = {
  slug: "deleted-account-resurrection",
  number: 5,
  title: "The other tab brought the account back",
  summary:
    "Deleting an account in one tab made a second tab notice the missing profile and helpfully recreate it.",
  context: {
    label: "Multi-tab account flow",
    description:
      "An app whose auth layer subscribes to the signed-in user's document and repairs it when fields are missing.",
  },
  categories: ["concurrency", "browser", "async"],
  tech: ["React", "Realtime listeners", "Server callables"],
  simulation: "two-tabs",

  states: [
    {
      key: "broken",
      label: "Broken",
      headline:
        "The passive tab sees the profile vanish, assumes damage, and rebuilds it.",
      tryThis: [
        "Step through the deletion in Tab A and watch Tab B's listener react.",
        "Watch the user document and the username reservation come back.",
        "Notice that Tab B is still signed in to an account that no longer exists.",
      ],
    },
    {
      key: "first-fix",
      label: "First fix",
      headline:
        "Repair is suppressed and the server refuses to rebuild — but the tab is not clean yet.",
      tryThis: [
        "Step through again: the document stays deleted and Tab B signs out.",
        "Watch the moment the cascade blanks the display name, before the doc disappears.",
        "Look at what Tab B still has in memory after signing out.",
      ],
    },
    {
      key: "fixed",
      label: "Fixed",
      headline:
        "A pending deletion short-circuits every repair path, and the tab drops its caches on the way out.",
      tryThis: [
        "Step through the whole sequence once more, watching all three panels.",
        "Confirm the blanked-name step no longer triggers a repair call.",
        "Confirm the in-memory caches are empty after the sign-out.",
      ],
    },
  ],

  whatHappened: [
    "The auth layer subscribed to the signed-in user's document with a realtime listener. If the document was missing, or was missing a display name or an avatar, it called a repair routine that recreated it — a sensible guard against a half-finished signup.",
    "Deleting an account ran a server-side cascade: remove the user document, the username reservation, and everything the account owned. Any tab still open, including the one that started the deletion, was watching that document.",
    "So the listener fired with a missing document, decided the profile was damaged, and called the repair callable. The account came back — with its username reservation — moments after the backend had removed it. A second tab open elsewhere in the app did the same thing independently.",
    "The first fix stopped the resurrection. Reviewing it turned up two smaller problems in the same handler, which is why this exhibit has three states rather than two.",
  ],

  rootCause: [
    "“The document is missing” has two meanings and the code only knew one. A missing profile after signup is damage worth repairing; a missing profile during deletion is the intended outcome. The listener could not tell them apart, so it treated a successful delete as corruption.",
    "The fix gives the client a way to know. The deletion flow marks the uid in a module-level set before it starts, and the cascade sets `deletionPending: true` on the document before removing it — so a tab that was not the one clicking Delete still sees the intent arrive through the same stream it is already listening to.",
    "The client guard alone would not be enough. A stale client or a not-yet-expired token can call the profile endpoints directly, so the server writes a tombstone record **before** removing the user document, and the create and update endpoints refuse while a tombstone exists. The tombstone is the authoritative guard; the in-memory flag just closes the same-tab window without an extra read.",
  ],

  whyFirstFixFailed: [
    "The first fix caught the obvious path — the snapshot where the document does not exist — and missed the one just before it.",
    "The cascade blanks fields on the way down, so for a moment the document still exists with an empty display name. That is the *other* repair trigger, and it fired a call into a profile that was being torn down. The complete version returns early the moment it sees `deletionPending: true`, before any repair check runs.",
    "The second gap was quieter. The passive tab signed out correctly, but signing out through this branch skipped the cache clearing the normal sign-out path does, so the tab kept a profile, a content list and a user cache belonging to an account that no longer existed. Mirroring those three calls was the last change on the branch.",
  ],

  excerpts: [
    {
      caption: "The branch that used to repair",
      kind: "code",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "const unsubscribe = onSnapshot(userRef, (snapshot) => {",
        "  if (!snapshot.exists()) {",
        "    // Account is mid-deletion: do NOT repair/recreate the profile,",
        "    // or the listener resurrects the user doc + username reservation",
        "    // the backend just removed. Sign out so the listener detaches.",
        "    if (",
        "      sawDeletionPendingRef.current ||",
        "      isAccountDeletionInProgress(user.uid)",
        "    ) {",
        "      setProfile(null);",
        "      clearProfileCache();",
        "      clearContentCache();",
        "      clearUserCache();",
        "      void signOut(auth);",
        "      return;",
        "    }",
        "    if (!repairingRef.current.has(user.uid)) {",
        "      /* ... the old behaviour: recreate the profile ... */",
        "    }",
        "  }",
      ],
    },
    {
      caption: "The step before the document goes",
      kind: "diff",
      language: "tsx",
      origin: "reproduction",
      lines: [
        "-    const data = snapshot.data() as Omit<UserProfile, \"id\">;",
        "+    const data = snapshot.data() as Omit<UserProfile, \"id\"> & {",
        "+      deletionPending?: boolean;",
        "+    };",
        "+    if (data.deletionPending === true) {",
        "+      // Being torn down — show current data but never trigger a repair.",
        "+      sawDeletionPendingRef.current = true;",
        "+      setProfile({ id: snapshot.id, ...data });",
        "+      return;",
        "+    }",
        "     const needsRepair =",
        "       !data.displayName?.trim() || !data.avatarUrl?.trim();",
      ],
    },
    {
      caption: "The authoritative guard, on the server",
      kind: "code",
      language: "ts",
      origin: "reproduction",
      lines: [
        "// Reject profile create/update for a uid whose account is mid-deletion.",
        "// The delete cascade writes the tombstone before it removes the user",
        "// doc, so this blocks a stale client or a not-yet-expired token from",
        "// rebuilding the profile it just deleted.",
        "async function assertNotTombstoned(uid: string) {",
        "  const snap = await db.doc(`deletionTombstones/${uid}`).get();",
        "  if (snap.exists) {",
        "    throw new HttpsError(",
        "      \"failed-precondition\",",
        "      \"This account is being deleted.\",",
        "    );",
        "  }",
        "}",
      ],
    },
  ],

  test: {
    intro: [
      "The failure mode here is an *old tab running yesterday's bundle*, which is exactly what a client-side test cannot reason about. So the real-world guard is layered — a tombstone written before the delete, both write endpoints checking it, and rules denying the tombstone collection to clients — rather than a single assertion.",
      "What the museum can pin is the sequence. `lib/sims/two-tabs.ts` holds the three versions as scripted frames: server state, both tabs, and what each step does. The tests then assert the invariants that distinguish them, which is stricter than it sounds, because the interesting properties are all negative.",
      "Nine cases. The broken script must end with the document recreated and the reservation held; the first-fix script must end deleted and signed out but still holding caches; the fixed script must end with zero repair calls and zero caches. One case checks the ordering that makes the server guard work at all — the tombstone has to be written before the document is removed, in every version that has one.",
      "This is a scripted model of a sequence, not a running backend, and the display case says so.",
    ],
    excerpt: {
      caption: "tests/unit/sims/two-tabs.test.ts",
      kind: "code",
      language: "ts",
      origin: "museum-source",
      href: UNIT,
      lines: [
        "it(\"ends with the account resurrected in the broken version\", () => {",
        "  const end = last(TAB_SCRIPTS.broken);",
        "  expect(end?.server.userDoc).toBe(\"recreated\");",
        "  expect(end?.server.usernameReservation).toBe(true);",
        "  expect(end?.tabB.repairCalls).toBeGreaterThan(0);",
        "});",
        "",
        "it(\"writes the tombstone before the document is removed\", () => {",
        "  for (const version of [\"first-fix\", \"fixed\"] as const) {",
        "    const frames = TAB_SCRIPTS[version];",
        "    const tombstoneAt = frames.findIndex((f) => f.server.tombstone);",
        "    const deletedAt = frames.findIndex(",
        "      (f) => f.server.userDoc === \"deleted\",",
        "    );",
        "    expect(tombstoneAt).toBeGreaterThanOrEqual(0);",
        "    expect(tombstoneAt).toBeLessThan(deletedAt);",
        "  }",
        "});",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "Deleted accounts came back",
      detail:
        "Found while auditing the deletion cascade: the listener's profile-repair path treats a deleted document as a damaged one. Step through the Broken state to watch it happen.",
      source: { kind: "simulation", label: "The simulation", href: SIMULATION },
    },
    {
      phase: "attempted",
      title: "Suppress the repair, and refuse it on the server",
      detail:
        "A module-level in-progress flag plus a `deletionPending` field stop the client; a tombstone written before the delete stops everyone else. The passive tab signs out instead of repairing.",
    },
    {
      phase: "fixed",
      title: "Two gaps found in review",
      detail:
        "Return early on `deletionPending` so the blanked-display-name path cannot fire a repair, and clear the profile, content and user caches when signing out through the deletion branch.",
      source: { kind: "simulation-logic", label: "lib/sims/two-tabs.ts", href: LOGIC },
    },
    {
      phase: "regression-test",
      title: "Guarded in three places rather than tested in one",
      detail:
        "The client that has to be stopped is an old one, so the guard is layered rather than asserted. The museum pins the sequence instead: nine cases over the three scripts, including the tombstone ordering.",
      source: { kind: "regression-test", label: "tests/unit/sims/two-tabs.test.ts", href: UNIT },
    },
  ],

  sources: [
    {
      kind: "exhibit-definition",
      label: "content/exhibits/deleted-account-resurrection.ts",
      href: DEFINITION,
    },
    {
      kind: "simulation",
      label: "components/sims/tabs/tabs-sim.tsx",
      href: SIMULATION,
      note: "Two tabs, the server, and a step-through you can stop anywhere.",
    },
    {
      kind: "simulation-logic",
      label: "lib/sims/two-tabs.ts",
      href: LOGIC,
      note: "The three scripts, frame by frame.",
    },
    {
      kind: "regression-test",
      label: "tests/unit/sims/two-tabs.test.ts",
      href: UNIT,
      note: "Nine invariants, mostly negative ones.",
    },
  ],

  evidence:
    "Three scripted sequences you can step through here, with the invariants that separate them asserted in the unit tests. A model of the ordering, not a running backend.",
  simulationNote:
    "There is no server here. The two tabs, the listener and the cascade are a scripted model of the sequence, stepped by hand so you can stop between any two events. The frames are hand-written; the tests assert the invariants at the end of each one.",
};
