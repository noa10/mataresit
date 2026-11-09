import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: hoisted.supabase,
}));

vi.mock("@/lib/ai-search", () => ({
  generateEmbeddingsForReceipt: vi.fn(),
}));

vi.mock("@/services/cacheInvalidationService", () => ({
  CacheInvalidationService: {},
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { fetchReceiptNeighbors } from "@/services/receiptService";

const olderReceipt = {
  id: "receipt-0",
  merchant: "Older Merchant",
  date: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
};

const newerReceipt = {
  id: "receipt-2",
  merchant: "Newer Merchant",
  date: "2026-01-03",
  created_at: "2026-01-03T00:00:00Z",
};

const createBuilder = () => {
  let comparator: "lt" | "gt" | null = null;

  const builder: Record<string, any> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn((filter: string) => {
      comparator =
        filter.startsWith("date.lt.") || filter.startsWith("created_at.lt.")
          ? "lt"
          : "gt";
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() =>
      Promise.resolve({
        data: [comparator === "lt" ? olderReceipt : newerReceipt],
        error: null,
      })
    ),
  };

  return builder;
};

describe("fetchReceiptNeighbors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    hoisted.supabase.from.mockImplementation(() => createBuilder());
  });

  it("maps previous to the earlier date and next to the later date", async () => {
    const date = "2026-01-02";
    const createdAt = "2026-01-02T00:00:00.123456+00:00";

    const neighbors = await fetchReceiptNeighbors({
      id: "receipt-1",
      date,
      created_at: createdAt,
      team_id: null,
      user_id: "user-1",
    });

    expect(neighbors.previous?.id).toBe("receipt-0");
    expect(neighbors.next?.id).toBe("receipt-2");

    const [previousBuilder, nextBuilder] = hoisted.supabase.from.mock.results.map(
      (result) => result.value
    );

    // Raw values: supabase-js encodes them exactly once when building the URL.
    expect(previousBuilder.or).toHaveBeenCalledWith(
      `date.lt.${date},and(date.eq.${date},created_at.lt.${createdAt}),and(date.eq.${date},created_at.eq.${createdAt},id.lt.receipt-1)`
    );
    expect(previousBuilder.order).toHaveBeenNthCalledWith(1, "date", {
      ascending: false,
    });
    expect(previousBuilder.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: false,
    });
    expect(previousBuilder.order).toHaveBeenNthCalledWith(3, "id", {
      ascending: false,
    });

    expect(nextBuilder.or).toHaveBeenCalledWith(
      `date.gt.${date},and(date.eq.${date},created_at.gt.${createdAt}),and(date.eq.${date},created_at.eq.${createdAt},id.gt.receipt-1)`
    );
    expect(nextBuilder.order).toHaveBeenNthCalledWith(1, "date", {
      ascending: true,
    });
    expect(nextBuilder.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: true,
    });
    expect(nextBuilder.order).toHaveBeenNthCalledWith(3, "id", {
      ascending: true,
    });
  });

  it("falls back to upload order when the receipt has no date", async () => {
    const createdAt = "2026-01-02T00:00:00.123456+00:00";

    await fetchReceiptNeighbors({
      id: "receipt-1",
      date: null as any,
      created_at: createdAt,
      team_id: null,
      user_id: "user-1",
    });

    const [previousBuilder, nextBuilder] = hoisted.supabase.from.mock.results.map(
      (result) => result.value
    );

    expect(previousBuilder.or).toHaveBeenCalledWith(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.receipt-1)`
    );
    expect(previousBuilder.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: false,
    });
    expect(previousBuilder.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: false,
    });

    expect(nextBuilder.or).toHaveBeenCalledWith(
      `created_at.gt.${createdAt},and(created_at.eq.${createdAt},id.gt.receipt-1)`
    );
    expect(nextBuilder.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: true,
    });
    expect(nextBuilder.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: true,
    });
  });

  it("scopes the query to the viewed receipt's team", async () => {
    await fetchReceiptNeighbors(
      {
        id: "receipt-1",
        date: "2026-01-02",
        created_at: "2026-01-02T00:00:00Z",
        team_id: "receipt-team",
        user_id: "user-1",
      },
      { currentTeam: null }
    );

    const builders = hoisted.supabase.from.mock.results.map(
      (result) => result.value
    );

    builders.forEach((builder) => {
      expect(builder.eq).toHaveBeenCalledWith("team_id", "receipt-team");
      expect(builder.is).not.toHaveBeenCalled();
    });
  });

  it("throws PostgREST errors so React Query can retry", async () => {
    const firstBuilder = createBuilder();
    firstBuilder.limit.mockResolvedValueOnce({
      data: null,
      error: { message: "network error" },
    });
    hoisted.supabase.from
      .mockImplementationOnce(() => firstBuilder)
      .mockImplementationOnce(() => createBuilder());

    await expect(
      fetchReceiptNeighbors({
        id: "receipt-1",
        date: "2026-01-02",
        created_at: "2026-01-02T00:00:00Z",
        team_id: null,
        user_id: "user-1",
      })
    ).rejects.toEqual(expect.objectContaining({ message: "network error" }));
  });
});
