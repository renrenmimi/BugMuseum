import { describe, expect, it } from "vitest";
import { TAB_SCRIPTS } from "@/lib/sims/two-tabs";

const last = <T,>(items: readonly T[]) => items[items.length - 1];

describe("the scripted deletion race", () => {
  it("ends with the account resurrected in the broken version", () => {
    const end = last(TAB_SCRIPTS.broken);
    expect(end?.server.userDoc).toBe("recreated");
    expect(end?.server.usernameReservation).toBe(true);
    expect(end?.tabB.repairCalls).toBeGreaterThan(0);
  });

  it("never writes a tombstone in the broken version", () => {
    expect(TAB_SCRIPTS.broken.some((f) => f.server.tombstone)).toBe(false);
  });

  it("stops the resurrection in the first fix", () => {
    const end = last(TAB_SCRIPTS["first-fix"]);
    expect(end?.server.userDoc).toBe("deleted");
    expect(end?.server.usernameReservation).toBe(false);
    expect(end?.tabB.signedIn).toBe(false);
  });

  it("still attempts a repair in the first fix, from the blanked-name path", () => {
    const end = last(TAB_SCRIPTS["first-fix"]);
    expect(end?.tabB.repairCalls).toBe(1);
  });

  it("leaves the first fix holding stale caches", () => {
    const end = last(TAB_SCRIPTS["first-fix"]);
    const held =
      Number(end?.tabB.caches.profile) +
      Number(end?.tabB.caches.pets) +
      Number(end?.tabB.caches.users);
    expect(end?.tabB.signedIn).toBe(false);
    expect(held).toBeGreaterThan(0);
  });

  it("never repairs and never keeps a cache in the fixed version", () => {
    const end = last(TAB_SCRIPTS.fixed);
    expect(end?.tabA.repairCalls).toBe(0);
    expect(end?.tabB.repairCalls).toBe(0);
    expect(end?.tabB.caches).toEqual({
      profile: false,
      pets: false,
      users: false,
    });
    expect(end?.server.userDoc).toBe("deleted");
  });

  it("writes the tombstone before the document is removed", () => {
    for (const version of ["first-fix", "fixed"] as const) {
      const frames = TAB_SCRIPTS[version];
      const tombstoneAt = frames.findIndex((f) => f.server.tombstone);
      const deletedAt = frames.findIndex((f) => f.server.userDoc === "deleted");
      expect(tombstoneAt).toBeGreaterThanOrEqual(0);
      expect(tombstoneAt).toBeLessThan(deletedAt);
    }
  });

  it("gives every version a walkable number of steps", () => {
    for (const frames of Object.values(TAB_SCRIPTS)) {
      expect(frames.length).toBeGreaterThanOrEqual(5);
      expect(frames.length).toBeLessThanOrEqual(10);
    }
  });
});
