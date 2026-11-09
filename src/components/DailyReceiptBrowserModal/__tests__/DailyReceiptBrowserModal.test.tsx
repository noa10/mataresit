/**
 * @vitest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchReceiptsByIds: vi.fn(),
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock("@/services/receiptService", () => ({
  fetchReceiptsByIds: mocks.fetchReceiptsByIds,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => mocks.channel,
  },
}));

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({ currentTeam: null }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useReceiptsTranslation: () => ({
    t: (key: string) =>
      key === "batch.browser.goToReceipts" ? "Go to Receipts" : key,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/utils/currency", () => ({
  formatCurrencySafe: () => "MYR 30.60",
}));

vi.mock("@/components/ReceiptViewer", () => ({
  default: ({ receipt }: { receipt: { id: string } }) => (
    <div>viewer {receipt.id}</div>
  ),
}));

import DailyReceiptBrowserModal from "../index";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const receipt = {
  id: "receipt-1",
  merchant: "PERNIAGAAN WAH SING SDN BHD",
  date: "2026-10-03",
  total: 30.6,
  currency: "MYR",
  status: "reviewed",
};

function renderModal(onGoToReceipts?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DailyReceiptBrowserModal
        date="2026-11-08"
        receiptIds={[receipt.id]}
        isOpen
        onClose={() => {}}
        onGoToReceipts={onGoToReceipts}
      />
    </QueryClientProvider>
  );
}

describe("DailyReceiptBrowserModal receipts tab action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchReceiptsByIds.mockResolvedValue([receipt]);
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockReturnValue(mocks.channel);
  });

  it("goes to the Receipts list", async () => {
    const onGoToReceipts = vi.fn();
    renderModal(onGoToReceipts);

    await userEvent.click(
      await screen.findByRole("button", { name: "Go to Receipts" })
    );

    expect(onGoToReceipts).toHaveBeenCalledTimes(1);
  });

  it("hides the action when no handler is provided", async () => {
    renderModal();

    expect(await screen.findByText("viewer receipt-1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Go to Receipts" })
    ).not.toBeInTheDocument();
  });
});
