import type { ReceiptWithDetails } from "@/types/receipt";
import { normalizeCurrencyCode } from "@/utils/currency";

// The editor initialises missing numbers as 0, strings as "" and booleans as
// false, while the database returns null. Compare by field type so those
// defaults do not look like edits.
const NUMERIC_RECEIPT_FIELDS = new Set(["total", "tax", "subtotal"]);
const BOOLEAN_RECEIPT_FIELDS = new Set(["is_business_expense"]);

export const normalizeReceiptValue = (key: string, value: unknown): unknown => {
  if (key === "currency") {
    return normalizeCurrencyCode(String(value ?? ""), "MYR");
  }

  if (NUMERIC_RECEIPT_FIELDS.has(key)) {
    if (value === null || value === undefined || value === "") return 0;
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (BOOLEAN_RECEIPT_FIELDS.has(key)) {
    return Boolean(value);
  }

  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        description: String(item?.description ?? ""),
        amount:
          typeof item?.amount === "number"
            ? item.amount
            : Number(item?.amount) || 0,
      }))
      .sort((left, right) => left.description.localeCompare(right.description));
  }
  return String(value);
};

export const receiptValuesEqual = (
  key: string,
  left: unknown,
  right: unknown
): boolean =>
  JSON.stringify(normalizeReceiptValue(key, left)) ===
  JSON.stringify(normalizeReceiptValue(key, right));

export const hasReceiptChanges = (
  current: ReceiptWithDetails,
  original: ReceiptWithDetails
): boolean => {
  const currentValues = current as unknown as Record<string, unknown>;
  const originalValues = original as unknown as Record<string, unknown>;
  const keys = new Set([
    ...Object.keys(currentValues),
    ...Object.keys(originalValues),
  ]);

  return Array.from(keys).some((key) => {
    if (key === "updated_at" || key === "created_at") return false;
    if (key === "confidence_scores" || key === "processing_status") return false;
    return !receiptValuesEqual(
      key,
      currentValues[key],
      originalValues[key]
    );
  });
};
