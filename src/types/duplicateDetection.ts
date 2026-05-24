import type { Receipt } from "./receipt";

/**
 * Union type representing the fields that can be used to match duplicate receipts.
 */
export type DuplicateMatchField =
  | "merchant"
  | "date"
  | "total"
  | "tax"
  | "currency";

/**
 * Configuration for the duplicate receipt scan.
 *
 * Default values:
 * - merchantEnabled: true
 * - dateToleranceDays: 0
 * - totalTolerance: 0.01
 */
export interface ScanConfig {
  /** Whether to match on merchant name (always enabled). */
  merchantEnabled: boolean;
  /** Whether to match on receipt date. */
  dateEnabled: boolean;
  /** Tolerance in days for date matching (0 = exact match). */
  dateToleranceDays: number;
  /** Whether to match on total amount. */
  totalEnabled: boolean;
  /** Tolerance as a fraction of the total for fuzzy matching (e.g. 0.01 = 1%). */
  totalTolerance: number;
  /** Whether to match on tax amount. */
  taxEnabled: boolean;
  /** Whether to match on currency. */
  currencyEnabled: boolean;
}

/**
 * A group of receipts identified as duplicates.
 */
export interface DuplicateGroup {
  /** Unique identifier for this duplicate group. */
  id: string;
  /** The receipts that are considered duplicates of each other. */
  receipts: Receipt[];
  /** Human-readable description of which fields matched (e.g. "merchant + date"). */
  matchCriteria: string;
  /** The ID of the receipt kept (the "original" / best copy). */
  keptReceiptId: string;
}

/**
 * Result of a duplicate scan operation.
 */
export interface ScanResult {
  /** Groups of duplicate receipts found. */
  groups: DuplicateGroup[];
  /** Total number of duplicate receipts across all groups. */
  totalDuplicates: number;
  /** Number of receipts scanned. */
  scannedCount: number;
  /** ISO 8601 timestamp of when the scan was performed. */
  scannedAt: string;
}

/**
 * Result of a duplicate deletion operation.
 */
export interface DeleteResult {
  /** IDs of the receipts that were deleted. */
  deletedIds: string[];
  /** IDs of the receipts that were kept. */
  keptIds: string[];
}
