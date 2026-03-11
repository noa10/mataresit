import { beforeEach, describe, expect, it } from "vitest";

import {
  captureReferralCodeFromSearch,
  clearPendingReferralCode,
  getPendingReferralCode,
  normalizeReferralCode,
} from "@/lib/referralTracking";

describe("referralTracking", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("captures referral codes from auth query strings", () => {
    expect(captureReferralCodeFromSearch("?ref= invite42 ")).toBe("INVITE42");
    expect(getPendingReferralCode()).toBe("INVITE42");
  });

  it("normalizes and clears pending referral codes", () => {
    expect(normalizeReferralCode("  abc123 ")).toBe("ABC123");

    captureReferralCodeFromSearch("?ref=abc123");
    clearPendingReferralCode();

    expect(getPendingReferralCode()).toBeNull();
  });
});