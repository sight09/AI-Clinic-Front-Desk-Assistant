import { describe, it, expect } from "vitest";
import { evaluateBooking, evaluateOfferAcceptance } from "@/lib/booking/service";
import { requireRole, assertOwnership, type SessionUser } from "@/lib/auth/service";
import { AppError } from "@/lib/errors";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("booking decisions (pure core)", () => {
  it("allows an open future slot", () => {
    expect(evaluateBooking({ status: "open", startAt: future }, new Date()).ok).toBe(true);
  });

  it("rejects booked slots", () => {
    const d = evaluateBooking({ status: "booked", startAt: future }, new Date());
    expect(d).toEqual({ ok: false, reason: "slot_unavailable" });
  });

  it("rejects past slots", () => {
    const d = evaluateBooking({ status: "open", startAt: past }, new Date());
    expect(d).toEqual({ ok: false, reason: "slot_in_past" });
  });

  it("rejects missing slots", () => {
    expect(evaluateBooking(null, new Date())).toEqual({ ok: false, reason: "slot_unavailable" });
  });
});

describe("waitlist offer transitions (pure core)", () => {
  it("valid offer on open slot → allowed", () => {
    expect(
      evaluateOfferAcceptance(
        { status: "offered", offerExpiresAt: future, offerSlotId: "s" },
        { status: "open", startAt: future },
        new Date(),
      ).ok,
    ).toBe(true);
  });

  it("expired offer → rejected", () => {
    const d = evaluateOfferAcceptance(
      { status: "offered", offerExpiresAt: past, offerSlotId: "s" },
      { status: "open", startAt: future },
      new Date(),
    );
    expect(d).toEqual({ ok: false, reason: "expired" });
  });

  it("slot taken meanwhile → rejected", () => {
    const d = evaluateOfferAcceptance(
      { status: "offered", offerExpiresAt: future, offerSlotId: "s" },
      { status: "booked", startAt: future },
      new Date(),
    );
    expect(d).toEqual({ ok: false, reason: "slot_gone" });
  });

  it("wrong state → rejected", () => {
    expect(
      evaluateOfferAcceptance(
        { status: "waiting", offerExpiresAt: null, offerSlotId: null },
        { status: "open", startAt: future },
        new Date(),
      ),
    ).toEqual({ ok: false, reason: "wrong_state" });
  });
});

describe("authorization", () => {
  const patient: SessionUser = { id: "p1", email: "p@x", name: "P", role: "patient" };
  const clinician: SessionUser = { id: "c1", email: "c@x", name: "C", role: "clinician" };

  it("patients cannot use clinician endpoints", () => {
    expect(() => requireRole(patient, ["clinician"])).toThrow(AppError);
  });

  it("ownership: patients read only their own records", () => {
    expect(() => assertOwnership(patient, "p1")).not.toThrow();
    expect(() => assertOwnership(patient, "p2")).toThrow(AppError);
  });

  it("staff bypass ownership checks", () => {
    expect(() => assertOwnership(clinician, "p2")).not.toThrow();
  });
});
