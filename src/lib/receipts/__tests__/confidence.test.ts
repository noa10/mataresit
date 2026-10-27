import { describe, expect, it } from "vitest";
import {
  calculateAggregateConfidence,
  getReceiptConfidence,
  isLowConfidence,
  normalizeConfidence,
  REVIEW_CONFIDENCE_THRESHOLD,
  type ConfidenceSource,
} from "@/lib/receipts/confidence";

const withScores = (scores: ConfidenceSource["confidence_scores"]): ConfidenceSource => ({
  confidence_scores: scores,
});

const fullScores = (value: number) => ({
  merchant: value,
  date: value,
  total: value,
  payment_method: value,
  tax: value,
});

describe("normalizeConfidence", () => {
  it("converts decimals to percentages", () => {
    expect(normalizeConfidence(0.93)).toBe(93);
    expect(normalizeConfidence(0.125)).toBe(13);
  });

  it("keeps percentage values as-is", () => {
    expect(normalizeConfidence(87)).toBe(87);
    expect(normalizeConfidence(100)).toBe(100);
  });

  it("falls back to 50 for missing or invalid values", () => {
    expect(normalizeConfidence(undefined)).toBe(50);
    expect(normalizeConfidence(null)).toBe(50);
    expect(normalizeConfidence(Number.NaN)).toBe(50);
  });

  it("caps values at 100", () => {
    expect(normalizeConfidence(140)).toBe(100);
  });
});

describe("calculateAggregateConfidence", () => {
  it("returns 0 when the receipt has no scores", () => {
    expect(calculateAggregateConfidence(withScores(undefined))).toBe(0);
  });

  it("uses a legacy overall score when present", () => {
    expect(
      calculateAggregateConfidence(withScores({ overall: 0.86 } as never))
    ).toBe(86);
  });

  it("weights the per-field scores", () => {
    // merchant 100 (0.3), date 100 (0.2), total 50 (0.3) = 65 / 0.8
    expect(
      calculateAggregateConfidence(
        withScores({ merchant: 100, date: 100, total: 50 })
      )
    ).toBe(81);
  });

  it("ignores fields without scores", () => {
    expect(
      calculateAggregateConfidence(withScores({ merchant: 0.9, total: 0.9 }))
    ).toBe(90);
  });
});

describe("getReceiptConfidence", () => {
  it("returns null when scores are missing", () => {
    expect(getReceiptConfidence(withScores(undefined))).toBeNull();
    expect(getReceiptConfidence(withScores({}))).toBeNull();
  });

  it("returns the aggregate for scored receipts", () => {
    expect(getReceiptConfidence(withScores(fullScores(0.93)))).toBe(93);
  });
});

describe("isLowConfidence", () => {
  it("flags receipts below the review threshold", () => {
    expect(isLowConfidence(withScores(fullScores(0.6)))).toBe(true);
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBe(85);
  });

  it("does not flag receipts at or above the threshold", () => {
    expect(isLowConfidence(withScores(fullScores(0.85)))).toBe(false);
    expect(isLowConfidence(withScores(fullScores(0.97)))).toBe(false);
  });

  it("does not flag receipts without scores", () => {
    expect(isLowConfidence(withScores(undefined))).toBe(false);
  });
});
