import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  queryBuilder: {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    ilike: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  },
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockQueryBuilder = hoisted.queryBuilder;
const mockSupabase = hoisted.supabase;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: hoisted.supabase,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { fetchReceiptsPage } from "@/services/receiptService";

const defaultReceipts = [
  {
    id: "r-1",
    merchant: "Store A",
    date: "2026-02-10",
    total: 100,
    currency: "MYR",
    status: "reviewed",
    payment_method: "card",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
  },
];

describe("fetchReceiptsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.is.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.ilike.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.gte.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.lte.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);

    mockSupabase.from.mockReturnValue(mockQueryBuilder);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
    });

    mockQueryBuilder.range.mockResolvedValue({
      data: defaultReceipts,
      error: null,
      count: 1,
    });
  });

  it("returns empty pagination payload when user is unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const result = await fetchReceiptsPage({ page: 1, limit: 10 });

    expect(result).toEqual({
      receipts: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("applies page and limit to range offset", async () => {
    await fetchReceiptsPage({ page: 3, limit: 25 }, { currentTeam: null as any });

    expect(mockQueryBuilder.range).toHaveBeenCalledWith(50, 74);
  });

  it("returns total count and pagination metadata", async () => {
    mockQueryBuilder.range.mockResolvedValue({
      data: defaultReceipts,
      error: null,
      count: 51,
    });

    const result = await fetchReceiptsPage({ page: 2, limit: 25 });

    expect(result.total).toBe(51);
    expect(result.totalPages).toBe(3);
    expect(result.hasPrevPage).toBe(true);
    expect(result.hasNextPage).toBe(true);
    expect(result.receipts).toHaveLength(1);
  });

  it("applies filters and sort options to query builder", async () => {
    await fetchReceiptsPage({
      page: 1,
      limit: 10,
      searchQuery: "Coffee",
      status: "reviewed",
      currency: "MYR",
      categoryId: "cat-1",
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
      sortOrder: "highest",
    });

    expect(mockQueryBuilder.ilike).toHaveBeenCalledWith("merchant", "%Coffee%");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("status", "reviewed");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("currency", "MYR");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("custom_category_id", "cat-1");
    expect(mockQueryBuilder.gte).toHaveBeenCalledWith("date", "2026-02-01");
    expect(mockQueryBuilder.lte).toHaveBeenCalledWith("date", "2026-02-28");
    expect(mockQueryBuilder.order).toHaveBeenCalledWith("total", { ascending: false });
  });

  it("maps uncategorized category filter to NULL check", async () => {
    await fetchReceiptsPage({ page: 1, limit: 10, categoryId: "uncategorized" });

    expect(mockQueryBuilder.is).toHaveBeenCalledWith("custom_category_id", null);
  });

  it("handles query errors safely", async () => {
    mockQueryBuilder.range.mockResolvedValue({
      data: null,
      error: { message: "boom" },
      count: null,
    });

    const result = await fetchReceiptsPage({ page: 1, limit: 10 });

    expect(result).toEqual({
      receipts: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });
});
