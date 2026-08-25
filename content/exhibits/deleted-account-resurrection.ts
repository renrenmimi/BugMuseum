import type { Exhibit } from "../schema";

const REPO = "https://github.com/renrenmimi/PetNote";
const PR = `${REPO}/pull/144`;
const SQUASH = `${REPO}/commit/dfa599f6ebb85628bf96ded77aa45f4178d543b3`;
const C1 = `${REPO}/commit/ee8cd496e`;
const C2 = `${REPO}/commit/9c0555ab7`;
const C3 = `${REPO}/commit/6e09818f7`;
const AUTH = `${REPO}/blob/main/src/contexts/AuthContext.tsx`;
const USERS = `${REPO}/blob/main/functions/src/users.ts`;
const GUARD = `${REPO}/blob/main/src/services/accountDeletion.ts`;

export const deletedAccountResurrection: Exhibit = {
  slug: "deleted-account-resurrection",
  number: 5,
  title: "The other tab brought the account back",
  summary:
    "Deleting an account in one tab made a second tab notice the missing profile and helpfully recreate it.",
  project: {
    name: "PetNote",
    repo: "renrenmimi/PetNote",
    href: REPO,
    blurb:
      "A small social app for pet owners, built on Firebase Auth and Firestore.",
  },
  categories: ["concurrency", "browser", "async"],
  tech: ["React", "Firebase", "Firestore", "Cloud Functions"],
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
        "Confirm the pet and user caches are empty after the sign-out.",
      ],
    },
  ],

  whatHappened: [
    "PetNote's auth context subscribes to `users/{uid}` with `onSnapshot`. If the document is missing, or is missing a display name or avatar, it calls a repair routine that recreates it — a sensible guard against a half-finished signup.",
    "Deleting an account runs a cascade in a Cloud Function: it removes the user document, the username reservation, the pets, the posts. Any tab still open, including the one that started the deletion, is watching that document.",
    "So the listener fired with a missing document, decided the profile was damaged, and called `ensureUserProfile`. The account came back — with its username reservation — moments after the backend had removed it. A second tab open on the feed did the same thing independently.",
    "The first fix stopped the resurrection. Reviewing it turned up two smaller problems in the same handler, which is why this exhibit has three states rather than two.",
  ],

  rootCause: [
    "“The document is missing” has two meanings and the code only knew one. A missing profile after signup is damage worth repairing; a missing profile during deletion is the intended outcome. The listener could not tell them apart, so it treated a successful delete as corruption.",
    "The fix gives the client a way to know. The deletion flow marks the uid in a module-level set before it starts, and the cascade sets `deletionPending: true` on the document before removing it — so a tab that was not the one clicking Delete still sees the intent arrive through the same snapshot stream it is already listening to.",
    "The client guard alone would not be enough. A stale client or a not-yet-expired token can call the profile callables directly, so the server writes `userDeletionTombstones/{uid}` *before* removing the user document, and `ensureUserProfile` / `updateUserProfile` refuse while a tombstone exists. The tombstone is the authoritative guard; the in-memory flag just closes the same-tab window without an extra read.",
  ],

  whyFirstFixFailed: [
    "The first fix caught the obvious path — the snapshot where the document does not exist — and missed the one just before it.",
    "The cascade blanks fields on the way down, so for a moment the document still exists with an empty display name. That is the *other* repair trigger, and it fired an uncaught call into a profile that was being torn down. The final version returns early the moment it sees `deletionPending: true`, before any repair check runs.",
    "The second gap was quieter. The passive tab signed out correctly, but sign-out through this branch skipped the cache clearing that the normal `signOut()` path does, so the tab kept a profile, a pet list and a user cache belonging to an account that no longer existed. Mirroring the three `clear*` calls was the last commit on the branch.",
  ],

  excerpts: [
    {
      caption: "src/contexts/AuthContext.tsx — the branch that used to repair",
      kind: "code",
      language: "tsx",
      verbatim: true,
      href: AUTH,
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
        "      setProfileLoading(false);",
        "      clearUserProfileCache();",
        "      clearPetCache();",
        "      clearCachedUsers();",
        "      void firebaseSignOut(auth);",
        "      return;",
        "    }",
        "    if (!profileRepairingRef.current.has(user.uid)) {",
        "      /* ... the old behaviour: recreate the profile ... */",
        "    }",
      ],
    },
    {
      caption: "src/contexts/AuthContext.tsx — the step before the document goes",
      kind: "diff",
      language: "tsx",
      verbatim: true,
      href: AUTH,
      lines: [
        "-    const data = snapshot.data() as Omit<UserProfile, \"id\">;",
        "+    const data = snapshot.data() as Omit<UserProfile, \"id\"> & {",
        "+      deletionPending?: boolean;",
        "+    };",
        "+    if (data.deletionPending === true) {",
        "+      // Being torn down — show current data but never trigger a repair.",
        "+      sawDeletionPendingRef.current = true;",
        "+      setProfile({ id: snapshot.id, ...data });",
        "+      setProfileLoading(false);",
        "+      return;",
        "+    }",
        "     const needsProfileRepair =",
        "       !data.displayName?.trim() || !data.avatarUrl?.trim();",
      ],
    },
    {
      caption: "functions/src/users.ts — the authoritative guard",
      kind: "code",
      language: "ts",
      verbatim: true,
      href: USERS,
      lines: [
        "// Reject profile create/update for a uid whose account is mid-deletion.",
        "// The deleteUserAccount cascade writes userDeletionTombstones/{uid}",
        "// before it removes the user doc, so this blocks a stale client or a",
        "// not-yet-expired token from rebuilding the profile it just deleted.",
        "async function assertUserNotDeletionTombstoned(uid: string) {",
        "  const snap = await db.doc(`userDeletionTombstones/${uid}`).get();",
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
      "This one is guarded by the server, not by a unit test, and the difference matters. A client-side test would only prove that this build of the app behaves — the failure mode is an old tab running yesterday's bundle.",
      "So the guard is layered. `userDeletionTombstones/{uid}` is written before the user document is removed, both profile callables check it, `updateUserProfile` additionally calls `assertActorNotDeleting`, and the Firestore rules deny all client access to the tombstone collection so it cannot be cleared from a browser. The tombstone carries a TTL field, because it only needs to outlive an auth token.",
      "The client guard is the same decision in a cheaper place: a module-level set of uids, shared between the Settings page that starts the deletion and the auth listener that would otherwise undo it.",
    ],
    excerpt: {
      caption: "src/services/accountDeletion.ts — the client-side half",
      kind: "code",
      language: "ts",
      verbatim: true,
      href: GUARD,
      lines: [
        "// Module-level guard shared between the account-deletion flow",
        "// (Settings) and the auth profile listener (AuthContext). While a uid",
        "// is marked in-progress, AuthContext must NOT recreate (\"repair\") the",
        "// user profile document when it observes the doc disappear",
        "// mid-deletion — otherwise the listener resurrects the account (and",
        "// its username reservation) that the backend just deleted. The",
        "// server-side tombstone is the authoritative guard; this flag closes",
        "// the same-tab window without an extra read.",
        "const deletingUids = new Set<string>();",
      ],
    },
  },

  timeline: [
    {
      phase: "discovered",
      title: "Deleted accounts came back",
      detail:
        "Found in an audit pass over the account-deletion cascade: the auth listener's profile-repair path treats a deleted document as a damaged one.",
      source: { kind: "pull-request", label: "PetNote PR #144", href: PR },
    },
    {
      phase: "attempted",
      title: "Suppress the repair, and refuse it on the server",
      detail:
        "A module-level in-progress flag plus a `deletionPending` field stop the client; a tombstone written before the delete stops everyone else. The passive tab signs out instead of repairing.",
      source: { kind: "commit", label: "ee8cd49 — the first fix", href: C1 },
    },
    {
      phase: "fixed",
      title: "Two gaps found in review",
      detail:
        "Return early on `deletionPending` so the blanked-display-name path cannot fire a repair, and clear the profile, pet and user caches when signing out through the deletion branch.",
      source: { kind: "commit", label: "9c0555a and 6e09818", href: C2 },
    },
    {
      phase: "regression-test",
      title: "Guarded in three places rather than tested in one",
      detail:
        "Tombstone check on both profile callables, `assertActorNotDeleting` on update, and a deny-all Firestore rule on the tombstone collection — because the client that has to be stopped is an old one.",
      source: { kind: "commit", label: "6e09818 — cache clearing", href: C3 },
    },
  ],

  sources: [
    {
      kind: "pull-request",
      label: "PR #144 — deletion race, dup submit, ghost posts, crash safety",
      href: PR,
      note: "The deletion race is item C1; the review comments cover the rest.",
    },
    { kind: "commit", label: "dfa599f — the squash commit on main", href: SQUASH },
    { kind: "file", label: "src/contexts/AuthContext.tsx", href: AUTH },
    { kind: "file", label: "functions/src/users.ts", href: USERS },
    { kind: "file", label: "src/services/accountDeletion.ts", href: GUARD },
  ],

  evidence:
    "PetNote PR #144 and its three commits, squashed to dfa599f — the first fix and the two review follow-ups are separate commits.",
  simulationNote:
    "There is no Firebase here. The two tabs, the listener and the cascade are a scripted model of the sequence described in the pull request, stepped by hand so you can stop between any two events.",
};
