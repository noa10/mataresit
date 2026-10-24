import type { Receipt } from "@/types/receipt";

/** Minimal shape the confidence helpers need. */
export type ConfidenceSource = Pick<Receipt, "confidence_scores">;

/**
 * Confidence helpers for receipt extraction.
 *
 * The database stores confidence scores either as decimals (0–1) or as
 * percentages (0–100), depending on which processing pipeline produced them.
 * Both shapes appear in production data, so all reads go through
 * `normalizeConfidence`.
 */

/** Confidence at or below this value routes a receipt to the review queue. */
export const REVIEW_CONFIDENCE_THRESHOLD = 85;

const DEFAULT_CONFIDENCE = 50;

/**
 * Normalize a raw confidence score to an integer percentage between 0 and 100.
 *
 * - decimals (0 < score < 1) are multiplied by 100
 * - values >= 1 are treated as already-percentage
 * - missing or invalid values fall back to 50%
 */
export function normalizeConfidence(score?: number | null): number {
  if (score === undefined || score === null) return DEFAULT_CONFIDENCE;

  const numericScore = Number(score);
  if (Number.isNaN(numericScore)) return DEFAULT_CONFIDENCE;

  const normalized = numericScore < 1 ? numericScore * 100 : numericScore;
  return Math.min(Math.round(normalized), 100);
}

/**
 * Weighted aggregate of the per-field confidence scores.
 *
 * Legacy Flutter records expose an `overall` score; those are used directly
 * when present. Records without any scores return 0 so that existing callers
 * (the receipts dashboard) keep their current behaviour.
 */
export function calculateAggregateConfidence(receipt: ConfidenceSource): number {
  const scores = receipt.confidence_scores as
    | (Receipt["confidence_scores"] & { overall?: number })
    | undefined;

  if (!scores) return 0;

  if (scores.overall !== undefined) {
    return normalizeConfidence(scores.overall);
  }

  const weights: Array<[keyof typeof scores, number]> = [
    ["merchant", 0.3],
    ["date", 0.2],
    ["total", 0.3],
    ["payment_method", 0.1],
    ["tax", 0.1],
  ];

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [field, weight] of weights) {
    const value = scores[field];
    if (value !== undefined && value !== null) {
      weightedSum += normalizeConfidence(value) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;

  return Math.min(Math.round(weightedSum / totalWeight), 100);
}

/**
 * Confidence for display purposes. Returns `null` when the receipt has no
 * scores at all, so the UI can hide the confidence bar instead of claiming 0%.
 */
export function getReceiptConfidence(receipt: ConfidenceSource): number | null {
  const scores = receipt.confidence_scores as
    | (Receipt["confidence_scores"] & { overall?: number })
    | undefined;

  if (!scores) return null;

  const hasAnyScore = Object.values(scores).some(
    (value) => value !== undefined && value !== null
  );

  if (!hasAnyScore) return null;

  return calculateAggregateConfidence(receipt);
}

/** True when the receipt has a confidence score below the review threshold. */
export function isLowConfidence(receipt: ConfidenceSource): boolean {
  const confidence = getReceiptConfidence(receipt);
  return confidence !== null && confidence < REVIEW_CONFIDENCE_THRESHOLD;
}
