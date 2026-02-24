import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ViewReceipt from "@/pages/ViewReceipt";

const mocks = vi.hoisted(() => ({
  fetchReceiptById: vi.fn(),
  deleteReceipt: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@example.com" } }),
}));

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({ currentTeam: null }),
}));

vi.mock("@/services/receiptService", () => ({
  fetchReceiptById: mocks.fetchReceiptById,
  deleteReceipt: mocks.deleteReceipt,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/utils/currency", () => ({
  formatCurrencySafe: () => "MYR 0.00",
}));

vi.mock("@/components/ReceiptViewer", () => ({
  default: ({ onDelete }: { onDelete?: (id: string) => void }) => (
    <button type="button" onClick={() => onDelete?.("receipt-1")}>
      Viewer Delete
    </button>
  ),
}));

function LocationObserver() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderViewReceipt(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/receipt/:id" element={<ViewReceipt />} />
          <Route path="/dashboard" element={<LocationObserver />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ViewReceipt dashboard navigation", () => {
  beforeEach(() => {
    mocks.fetchReceiptById.mockResolvedValue({
      id: "receipt-1",
      merchant: "Test Merchant",
      date: "2026-02-01",
      total: 12.5,
      currency: "MYR",
    });
    mocks.deleteReceipt.mockResolvedValue(true);
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  it("preserves dashboard filters when deleting from the receipt viewer", async () => {
    const initialEntry = "/receipt/receipt-1?q=groceries&tab=reviewed&currency=MYR&category=cat-team&sort=highest&page=2&limit=10&from=2026-02-01&to=2026-02-14&view=table&ignored=1";
    renderViewReceipt(initialEntry);

    await userEvent.click(await screen.findByRole("button", { name: "Viewer Delete" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe(
        "/dashboard?q=groceries&tab=reviewed&currency=MYR&category=cat-team&sort=highest&page=2&limit=10&from=2026-02-01&to=2026-02-14&view=table",
      );
    });
  });

  it("preserves dashboard filters when deleting from the page header button", async () => {
    const initialEntry = "/receipt/receipt-1?q=office&currency=USD&page=3&limit=25&view=list&foo=bar";
    renderViewReceipt(initialEntry);

    await userEvent.click(await screen.findByRole("button", { name: "Delete Receipt" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe(
        "/dashboard?q=office&currency=USD&page=3&limit=25&view=list",
      );
    });
  });
});
