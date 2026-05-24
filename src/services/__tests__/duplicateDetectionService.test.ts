import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Receipt } from "@/types/receipt";
import type { ScanConfig } from "@/types/duplicateDetection";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  buildScanQuery,
  deleteReceipts,
  groupDuplicates,
} from "@/services/duplicateDetectionService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultConfig: ScanConfig = {
  merchantEnabled: true,
  dateEnabled: false,
  dateToleranceDays: 0,
  totalEnabled: false,
  totalTolerance: 0.01,
  taxEnabled: false,
  currencyEnabled: false,
};

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    date: "2026-01-15",
    merchant: "Starbucks",
    total: 12.5,
    payment_method: "credit",
    status: "unreviewed",
    created_at: now,
    updated_at: now,
    currency: "USD",
    ...overrides,
  };
}

/**
 * Create a mock Supabase query builder that resolves with the given result.
 */
function mockQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: typeof result) => void) => resolve(result)),
  };
  return builder;
}

// ---------------------------------------------------------------------------
// groupDuplicates
// ---------------------------------------------------------------------------

describe("groupDuplicates", () => {
  it("groups 2 receipts by merchant and leaves a 3rd unmatched", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks" }),
      receipt({ id: "r2", merchant: "Starbucks" }),
      receipt({ id: "r3", merchant: "McDonald's" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(2);
    expect(groups[0].receipts.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    expect(groups[0].matchCriteria).toBe("merchant");
  });

  it("groups by merchant + date when dates match", () => {
    const config: ScanConfig = { ...defaultConfig, dateEnabled: true };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", date: "2026-01-15" }),
      receipt({ id: "r2", merchant: "Starbucks", date: "2026-01-15" }),
      receipt({ id: "r3", merchant: "Starbucks", date: "2026-02-01" }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(2);
    expect(groups[0].receipts.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    expect(groups[0].matchCriteria).toBe("merchant + date");
  });

  it("does NOT group by merchant + date when dates differ (tolerance 0)", () => {
    const config: ScanConfig = { ...defaultConfig, dateEnabled: true };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", date: "2026-01-15" }),
      receipt({ id: "r2", merchant: "Starbucks", date: "2026-02-01" }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(0);
  });

  it("groups when all fields (merchant + date + total + tax + currency) align", () => {
    const config: ScanConfig = {
      ...defaultConfig,
      dateEnabled: true,
      totalEnabled: true,
      taxEnabled: true,
      currencyEnabled: true,
    };
    const receipts = [
      receipt({
        id: "r1",
        merchant: "Starbucks",
        date: "2026-01-15",
        total: 10.0,
        tax: 0.5,
        currency: "USD",
      }),
      receipt({
        id: "r2",
        merchant: "Starbucks",
        date: "2026-01-15",
        total: 10.0,
        tax: 0.5,
        currency: "USD",
      }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(1);
    expect(groups[0].matchCriteria).toBe("merchant + date + total + tax + currency");
  });

  it("matches totals within tolerance (5.00 and 5.004)", () => {
    const config: ScanConfig = {
      ...defaultConfig,
      totalEnabled: true,
      totalTolerance: 0.01,
    };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", total: 5.0 }),
      // 5.004 / 0.01 = 500.4 → Math.round → 500 → 500 * 0.01 = 5.00 ✓
      receipt({ id: "r2", merchant: "Starbucks", total: 5.004 }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(1);
  });

  it("does NOT match totals outside tolerance (5.00 and 5.02)", () => {
    const config: ScanConfig = {
      ...defaultConfig,
      totalEnabled: true,
      totalTolerance: 0.01,
    };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", total: 5.0 }),
      receipt({ id: "r2", merchant: "Starbucks", total: 5.02 }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(0);
  });

  it("groups receipts 1 day apart when dateToleranceDays is 3", () => {
    const config: ScanConfig = {
      ...defaultConfig,
      dateEnabled: true,
      dateToleranceDays: 3,
    };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", date: "2026-01-14" }),
      receipt({ id: "r2", merchant: "Starbucks", date: "2026-01-15" }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(1);
  });

  it("does NOT group receipts 2 days apart when dateToleranceDays is 0", () => {
    const config: ScanConfig = {
      ...defaultConfig,
      dateEnabled: true,
      dateToleranceDays: 0,
    };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", date: "2026-01-15" }),
      receipt({ id: "r2", merchant: "Starbucks", date: "2026-01-17" }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(0);
  });

  it("excludes receipts with null or empty merchant from grouping", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "" }),
      receipt({ id: "r2", merchant: "   " }),
      receipt({ id: "r3", merchant: "Starbucks" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const groups = groupDuplicates([], defaultConfig);

    expect(groups).toEqual([]);
  });

  it("returns empty array for a single receipt", () => {
    const receipts = [receipt({ id: "r1", merchant: "Starbucks" })];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(0);
  });

  it("determines oldest by date (earlier date wins)", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", date: "2026-01-20", created_at: "2026-01-20T10:00:00Z" }),
      receipt({ id: "r2", merchant: "Starbucks", date: "2026-01-15", created_at: "2026-01-15T10:00:00Z" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(1);
    expect(groups[0].keptReceiptId).toBe("r2");
    expect(groups[0].receipts[0].id).toBe("r2");
  });

  it("determines oldest by created_at when dates are equal", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", date: "2026-01-15", created_at: "2026-01-15T12:00:00Z" }),
      receipt({ id: "r2", merchant: "Starbucks", date: "2026-01-15", created_at: "2026-01-15T08:00:00Z" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(1);
    expect(groups[0].keptReceiptId).toBe("r2");
    expect(groups[0].receipts[0].id).toBe("r2");
  });

  it("does NOT group receipts with different currencies when currency matching is enabled", () => {
    const config: ScanConfig = { ...defaultConfig, currencyEnabled: true };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", currency: "USD" }),
      receipt({ id: "r2", merchant: "Starbucks", currency: "EUR" }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(0);
  });

  it("uses normalized_merchant when available", () => {
    // The service casts to ReceiptWithNormalized internally, so we pass
    // the extra property via the Receipt shape (it's accepted at runtime).
    const receipts = [
      { ...receipt({ id: "r1", merchant: "Starbucks Coffee" }), normalized_merchant: "starbucks" },
      { ...receipt({ id: "r2", merchant: "Starbucks Cafe" }), normalized_merchant: "starbucks" },
    ] as Receipt[];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(2);
  });

  it("groups 3+ receipts into a single group when all match", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks" }),
      receipt({ id: "r2", merchant: "Starbucks" }),
      receipt({ id: "r3", merchant: "Starbucks" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(3);
  });

  it("produces multiple groups when there are multiple duplicate clusters", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks" }),
      receipt({ id: "r2", merchant: "Starbucks" }),
      receipt({ id: "r3", merchant: "McDonald's" }),
      receipt({ id: "r4", merchant: "McDonald's" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups).toHaveLength(2);
    expect(groups[0].receipts).toHaveLength(2);
    expect(groups[1].receipts).toHaveLength(2);
  });

  it("assigns a unique id to each group", () => {
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks" }),
      receipt({ id: "r2", merchant: "Starbucks" }),
      receipt({ id: "r3", merchant: "McDonald's" }),
      receipt({ id: "r4", merchant: "McDonald's" }),
    ];

    const groups = groupDuplicates(receipts, defaultConfig);

    expect(groups[0].id).toMatch(/^dup-/);
    expect(groups[1].id).toMatch(/^dup-/);
    expect(groups[0].id).not.toBe(groups[1].id);
  });

  it("handles tax matching with tolerance", () => {
    const config: ScanConfig = {
      ...defaultConfig,
      taxEnabled: true,
      totalTolerance: 0.01,
    };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", tax: 1.0 }),
      // 1.004 / 0.01 = 100.4 → Math.round → 100 → 100 * 0.01 = 1.00 ✓
      receipt({ id: "r2", merchant: "Starbucks", tax: 1.004 }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(1);
  });

  it("handles undefined tax gracefully", () => {
    const config: ScanConfig = { ...defaultConfig, taxEnabled: true };
    const receipts = [
      receipt({ id: "r1", merchant: "Starbucks", tax: undefined }),
      receipt({ id: "r2", merchant: "Starbucks", tax: undefined }),
    ];

    const groups = groupDuplicates(receipts, config);

    expect(groups).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildScanQuery
// ---------------------------------------------------------------------------

describe("buildScanQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds query scoped by team_id when team context is provided", async () => {
    const builder = mockQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    const config: ScanConfig = { ...defaultConfig };
    await buildScanQuery(config, "team-1", "user-1");

    expect(fromMock).toHaveBeenCalledWith("receipts");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.eq).toHaveBeenCalledWith("team_id", "team-1");
    expect(builder.is).not.toHaveBeenCalled();
    expect(builder.limit).toHaveBeenCalledWith(1000);
  });

  it("builds query scoped by user_id when no team is provided", async () => {
    const builder = mockQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    const config: ScanConfig = { ...defaultConfig };
    await buildScanQuery(config, undefined, "user-1");

    expect(fromMock).toHaveBeenCalledWith("receipts");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.is).toHaveBeenCalledWith("team_id", null);
    expect(builder.limit).toHaveBeenCalledWith(1000);
  });

  it("returns empty array on query error", async () => {
    const builder = mockQueryBuilder({
      data: null,
      error: { message: "DB error" },
    });
    fromMock.mockReturnValue(builder);

    const config: ScanConfig = { ...defaultConfig };
    const result = await buildScanQuery(config, undefined, "user-1");

    expect(result).toEqual([]);
  });

  it("returns data array on success", async () => {
    const fakeReceipts = [receipt({ id: "r1" })];
    const builder = mockQueryBuilder({ data: fakeReceipts, error: null });
    fromMock.mockReturnValue(builder);

    const config: ScanConfig = { ...defaultConfig };
    const result = await buildScanQuery(config, "team-1", "user-1");

    expect(result).toEqual(fakeReceipts);
  });
});

// ---------------------------------------------------------------------------
// deleteReceipts
// ---------------------------------------------------------------------------

describe("deleteReceipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls supabase.delete().in() with the given IDs", async () => {
    const inMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ in: inMock });
    fromMock.mockReturnValue({ delete: deleteMock });

    const ids = ["r1", "r2", "r3"];
    const result = await deleteReceipts(ids);

    expect(fromMock).toHaveBeenCalledWith("receipts");
    expect(deleteMock).toHaveBeenCalled();
    expect(inMock).toHaveBeenCalledWith("id", ids);
    expect(result).toEqual({ deletedIds: ids, keptIds: [] });
  });

  it("returns empty result when ids array is empty", async () => {
    const result = await deleteReceipts([]);

    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({ deletedIds: [], keptIds: [] });
  });

  it("throws when the delete operation fails", async () => {
    const inMock = vi.fn().mockResolvedValue({ error: { message: "Delete failed" } });
    const deleteMock = vi.fn().mockReturnValue({ in: inMock });
    fromMock.mockReturnValue({ delete: deleteMock });

    await expect(deleteReceipts(["r1"])).rejects.toThrow(
      "Failed to delete receipts: Delete failed",
    );
  });
});
