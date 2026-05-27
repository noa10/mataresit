import { supabase } from "@/integrations/supabase/client";
import type { Receipt } from "@/types/receipt";
import type {
  ScanConfig,
  DuplicateGroup,
  ScanResult,
  DeleteResult,
} from "@/types/duplicateDetection";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Receipt with the optional normalized_merchant column that exists in the
 * database but is not yet part of the main Receipt interface.
 */
interface ReceiptWithNormalized extends Receipt {
  normalized_merchant?: string | null;
}

/**
 * Extract a canonical merchant key from a receipt.
 * Prefers normalized_merchant (DB column), falls back to trimming and
 * lowercasing the raw merchant field. Returns null when both are empty so
 * the receipt can be excluded from duplicate detection.
 */
function getMerchantKey(receipt: ReceiptWithNormalized): string | null {
  const normalized = receipt.normalized_merchant;
  if (typeof normalized === "string" && normalized.trim().length > 0) {
    return normalized.trim().toLowerCase();
  }
  const raw = receipt.merchant?.trim();
  if (raw && raw.length > 0) {
    return raw.toLowerCase();
  }
  return null;
}

/**
 * Format a date string to YYYY-MM-DD.
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build a human-readable match-criteria label from the enabled config flags.
 */
function buildMatchCriteria(config: ScanConfig): string {
  const parts: string[] = ["merchant"];
  if (config.dateEnabled) parts.push("date");
  if (config.totalEnabled) parts.push("total");
  if (config.taxEnabled) parts.push("tax");
  if (config.currencyEnabled) parts.push("currency");
  return parts.join(" + ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build and execute a Supabase query scoped by team or user.
 *
 * @param config  - Scan configuration (unused in query building but kept for
 *                  future server-side filtering).
 * @param teamId  - When provided, scopes receipts to this team.
 * @param userId  - When no teamId is given, scopes to this user's personal
 *                  receipts.
 * @returns Promise resolving to an array of Receipt rows (max 1 000).
 */
export async function buildScanQuery(
  _config: ScanConfig,
  teamId: string | undefined,
  userId: string,
): Promise<Receipt[]> {
  let query = supabase.from("receipts").select("*");

  if (teamId) {
    query = query.eq("team_id", teamId);
  } else {
    query = query.eq("user_id", userId).is("team_id", null);
  }

  query = query.limit(1000);

  const { data, error } = await query;

  if (error) {
    console.error("buildScanQuery: failed to fetch receipts", error);
    return [];
  }

  return (data as Receipt[]) ?? [];
}

/**
 * Client-side duplicate grouping algorithm.
 *
 * For each receipt a grouping key is built from the enabled fields in
 * `config`. Receipts whose merchant cannot be resolved are skipped.
 * Groups with only one member are discarded.
 *
 * @returns Array of DuplicateGroup, each with a unique id, sorted receipts,
 *          a keptReceiptId (oldest), and a matchCriteria label.
 */
export function groupDuplicates(
  receipts: Receipt[],
  config: ScanConfig,
): DuplicateGroup[] {
  if (!receipts || receipts.length === 0) {
    return [];
  }

  const map = new Map<string, Receipt[]>();

  for (const r of receipts as ReceiptWithNormalized[]) {
    // --- merchant (always) ---
    const merchantKey = getMerchantKey(r);
    if (merchantKey === null) continue; // skip receipts with no merchant

    const parts: string[] = [merchantKey];

    // --- date ---
    if (config.dateEnabled) {
      const dateStr = formatDate(r.date);
      if (config.dateToleranceDays > 0) {
        const epoch = new Date(dateStr).getTime();
        const windowMs = config.dateToleranceDays * 86_400_000;
        const bucket = Math.floor(epoch / windowMs) * windowMs;
        parts.push(String(bucket));
      } else {
        parts.push(dateStr);
      }
    }

    // --- total ---
    if (config.totalEnabled) {
      const tolerance = config.totalTolerance || 0.01;
      const rounded = Math.round(r.total / tolerance) * tolerance;
      parts.push(String(rounded));
    }

    // --- tax ---
    if (config.taxEnabled) {
      const tolerance = config.totalTolerance || 0.01;
      const tax = r.tax ?? 0;
      const rounded = Math.round(tax / tolerance) * tolerance;
      parts.push(String(rounded));
    }

    // --- currency ---
    if (config.currencyEnabled) {
      parts.push((r.currency ?? "").toUpperCase());
    }

    const key = parts.join("|");

    const existing = map.get(key);
    if (existing) {
      existing.push(r);
    } else {
      map.set(key, [r]);
    }
  }

  const groups: DuplicateGroup[] = [];
  let counter = 0;

  for (const [, groupReceipts] of map) {
    if (groupReceipts.length <= 1) continue;

    // Sort: oldest date first, then oldest created_at
    const sorted = [...groupReceipts].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    });

    groups.push({
      id: `dup-${++counter}-${crypto.randomUUID().slice(0, 8)}`,
      receipts: sorted,
      matchCriteria: buildMatchCriteria(config),
      keptReceiptId: sorted[0].id,
    });
  }

  return groups;
}

/**
 * Perform a full scan: query receipts, group them, and return a ScanResult.
 *
 * @param config  - Which fields to match on and their tolerances.
 * @param teamId  - Optional team scope.
 * @param userId  - User scope (used when teamId is absent).
 */
export async function scanForDuplicates(
  config: ScanConfig,
  teamId: string | undefined,
  userId: string,
): Promise<ScanResult> {
  const receipts = await buildScanQuery(config, teamId, userId);
  const groups = groupDuplicates(receipts, config);

  const totalDuplicates = groups.reduce(
    (sum, g) => sum + g.receipts.length,
    0,
  );

  return {
    groups,
    totalDuplicates,
    scannedCount: receipts.length,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Bulk-delete receipts by their IDs.
 *
 * @returns DeleteResult with the deleted IDs and an empty keptIds array
 *          (keptIds is populated by the caller after deciding which to keep).
 */
export async function deleteReceipts(ids: string[]): Promise<DeleteResult> {
  if (!ids || ids.length === 0) {
    return { deletedIds: [], keptIds: [] };
  }

  const { error } = await supabase
    .from("receipts")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("deleteReceipts: failed to delete receipts", error);
    throw new Error(`Failed to delete receipts: ${error.message}`);
  }

  return { deletedIds: ids, keptIds: [] };
}

/**
 * Fetch receipts by their UUIDs.
 *
 * @returns Array of Receipt rows (empty array when ids is empty or on error).
 */
export async function getReceiptsByIds(ids: string[]): Promise<Receipt[]> {
  if (!ids || ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .in("id", ids);

  if (error) {
    console.error("getReceiptsByIds: failed to fetch receipts", error);
    return [];
  }

  return (data as Receipt[]) ?? [];
}
