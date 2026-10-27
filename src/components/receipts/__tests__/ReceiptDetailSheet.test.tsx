/**
 * @vitest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Receipt } from "@/types/receipt";

const mocks = vi.hoisted(() => ({
  fetchReceiptById: vi.fn(),
  updateReceiptStatus: vi.fn(),
  deleteReceipt: vi.fn(),
}));

vi.mock("@/services/receiptService", () => ({
  fetchReceiptById: mocks.fetchReceiptById,
  updateReceiptStatus: mocks.updateReceiptStatus,
  deleteReceipt: mocks.deleteReceipt,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({
    currentTeam: { id: "team-1" },
    hasPermission: () => true,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useDashboardTranslation: () => ({
    t: (key: string) =>
      ({
        "workspace.detail.createClaim": "Create claim",
        "workspace.detail.deleteReceipt": "Delete receipt",
        "workspace.detail.deleteConfirmTitle": "Delete this receipt?",
        "workspace.detail.deleteConfirmDescription":
          "This removes the receipt and its image permanently.",
        "workspace.detail.deleteConfirmAction": "Delete receipt",
        "workspace.detail.cancel": "Cancel",
        "workspace.detail.deletedToast": "Receipt deleted",
        "workspace.detail.deleteFailedToast": "Could not delete receipt",
      })[key] ?? key,
  }),
}));

vi.mock("@/lib/receipts/confidence", () => ({
  getReceiptConfidence: () => 0.94,
}));

vi.mock("@/components/ledger/ReceiptPaper", () => ({
  ReceiptPaper: () => <div>receipt paper</div>,
}));
vi.mock("@/components/ledger/ConfidenceBar", () => ({
  ConfidenceBar: () => <div>confidence</div>,
}));
vi.mock("@/components/ledger/StatusChip", () => ({
  StatusChip: () => <div>status</div>,
}));
vi.mock("@/components/ledger/EmptyState", () => ({
  EmptyState: () => <div>empty state</div>,
}));

vi.mock("@/components/claims/CreateClaimDialog", () => ({
  CreateClaimDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="claim-dialog" /> : null,
}));

import { ReceiptDetailSheet } from "../ReceiptDetailSheet";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal("MutationObserver", MutationObserverMock);

const receipt = {
  id: "receipt-1",
  merchant: "Village Grocer Bangsar",
  date: "2026-10-24",
  total: 186.4,
  currency: "MYR",
  payment_method: "Visa",
  tax: 5.2,
  status: "unreviewed",
  image_url: "https://example.com/receipt.jpg",
  created_at: "2026-10-24T09:00:00Z",
  updated_at: "2026-10-24T09:00:00Z",
  lineItems: [],
  custom_category: { id: "cat-1", name: "Groceries", color: "#0B6B4D" },
  predicted_category: "Groceries",
} as unknown as Receipt;

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReceiptDetailSheet receiptId={receipt.id} onOpenChange={onOpenChange} />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { onOpenChange };
}

describe("ReceiptDetailSheet quick actions", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("MutationObserver", MutationObserverMock);
    mocks.fetchReceiptById.mockReset();
    mocks.updateReceiptStatus.mockReset();
    mocks.deleteReceipt.mockReset();
    mocks.fetchReceiptById.mockResolvedValue(receipt);
    mocks.updateReceiptStatus.mockResolvedValue(true);
    mocks.deleteReceipt.mockResolvedValue(true);
  });

  it("renders create claim and delete actions", async () => {
    renderSheet();

    expect(
      await screen.findByRole("button", { name: "Create claim" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete receipt" })
    ).toBeInTheDocument();
  });

  it("opens the claim dialog from the quick view", async () => {
    renderSheet();

    fireEvent.click(
      await screen.findByRole("button", { name: "Create claim" })
    );

    expect(screen.getByTestId("claim-dialog")).toBeInTheDocument();
  });

  it("deletes the receipt after confirmation", async () => {
    const { onOpenChange } = renderSheet();

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete receipt" })
    );

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete receipt" })
    );

    await waitFor(() => {
      expect(mocks.deleteReceipt).toHaveBeenCalledWith("receipt-1", {
        silent: true,
      });
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
