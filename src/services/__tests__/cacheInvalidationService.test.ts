import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/hooks/useSubscription", () => ({
  subscriptionQueryKeys: {
    usage: (userId: string) => ["subscription", "usage", userId],
  },
}));

import { CacheInvalidationService } from "@/services/cacheInvalidationService";

describe("CacheInvalidationService receipt updates", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    CacheInvalidationService.initialize(queryClient);
  });

  it("refreshes the workspace counts and overview after a receipt update", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await CacheInvalidationService.onReceiptUpdated("user-1");

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([filters]) => filters?.queryKey
    );

    expect(invalidatedKeys).toContainEqual(["receipt-counts"]);
    expect(invalidatedKeys).toContainEqual(["dashboard-summary"]);
    expect(invalidatedKeys).toContainEqual(["receipts", "neighbors"]);
  });
});
