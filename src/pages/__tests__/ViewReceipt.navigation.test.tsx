import type { HTMLAttributes } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ViewReceipt from "@/pages/ViewReceipt";

const mocks = vi.hoisted(() => ({
  fetchReceiptById: vi.fn(),
  fetchReceiptNeighbors: vi.fn(),
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
  fetchReceiptNeighbors: mocks.fetchReceiptNeighbors,
  deleteReceipt: mocks.deleteReceipt,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useReceiptsTranslation: () => ({
    t: (key: string, options?: { merchant?: string }) =>
      ({
        "navigation.previous": "Previous",
        "navigation.next": "Next",
        "navigation.previousTitle": `Previous: ${options?.merchant ?? ""}`,
        "navigation.nextTitle": `Next: ${options?.merchant ?? ""}`,
        "navigation.noPrevious": "No previous receipt",
        "navigation.noNext": "No next receipt",
        "navigation.untitledReceipt": "Untitled receipt",
        "navigation.uploadOrder": "Walks receipts in upload order",
        "navigation.unsavedChanges": "Discard changes?",
        "navigation.retry": "Retry",
      }[key] ?? key),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/utils/currency", () => ({
  formatCurrencySafe: () => "MYR 0.00",
}));

vi.mock("@/components/ReceiptViewer", () => ({
  default: ({
    onDelete,
    onDirtyChange,
    receipt,
  }: {
    onDelete?: (id: string) => void;
    onDirtyChange?: (isDirty: boolean) => void;
    receipt: { id: string };
  }) => (
    <>
      <div data-testid="viewer-receipt-id">{receipt.id}</div>
      <button type="button" onClick={() => onDelete?.("receipt-1")}>
        Viewer Delete
      </button>
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        Mark Dirty
      </button>
    </>
  ),
}));

function LocationObserver() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="location-key">{location.key}</div>
    </>
  );
}

function NavigationTypeObserver() {
  const navigationType = useNavigationType();
  return <div data-testid="navigation-type">{navigationType}</div>;
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
          <Route path="/receipt/:id" element={
            <>
              <LocationObserver />
              <NavigationTypeObserver />
              <ViewReceipt />
            </>
          } />
          <Route path="/receipts" element={<LocationObserver />} />
          <Route path="*" element={<LocationObserver />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ViewReceipt dashboard navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchReceiptById.mockImplementation(async (receiptId: string) => ({
      id: receiptId,
      merchant: "Test Merchant",
      date: "2026-02-01",
      total: 12.5,
      currency: "MYR",
      created_at: "2026-02-01T00:00:00.000Z",
      team_id: null,
      user_id: "user-1",
    }));
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: null,
      next: null,
    });
    mocks.deleteReceipt.mockResolvedValue(true);
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    vi.restoreAllMocks();
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  it("preserves dashboard filters when deleting from the receipt viewer", async () => {
    const initialEntry = "/receipt/receipt-1?q=groceries&tab=reviewed&currency=MYR&category=cat-team&sort=highest&page=2&limit=10&from=2026-02-01&to=2026-02-14&view=table&ignored=1";
    renderViewReceipt(initialEntry);

    await userEvent.click(await screen.findByRole("button", { name: "Viewer Delete" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe(
        "/receipts?q=groceries&tab=reviewed&currency=MYR&category=cat-team&sort=highest&page=2&limit=10&from=2026-02-01&to=2026-02-14&view=table",
      );
    });
  });

  it("preserves dashboard filters when deleting from the page header button", async () => {
    const initialEntry = "/receipt/receipt-1?q=office&currency=USD&page=3&limit=25&view=list&foo=bar";
    renderViewReceipt(initialEntry);

    await userEvent.click(await screen.findByRole("button", { name: "Delete Receipt" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe(
        "/receipts?q=office&currency=USD&page=3&limit=25&view=list",
      );
    });
  });

  it("moves to the next uploaded receipt", async () => {
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: null,
      next: {
        id: "receipt-2",
        merchant: "Next Merchant",
        date: "2026-02-02",
      },
    });

    renderViewReceipt("/receipt/receipt-1");

    await userEvent.click(
      await screen.findByRole("button", { name: "Next" })
    );

    await waitFor(() => {
      expect(mocks.fetchReceiptById).toHaveBeenCalledWith(
        "receipt-2",
        expect.anything()
      );
      expect(screen.getByTestId("viewer-receipt-id")).toHaveTextContent(
        "receipt-2"
      );
    });
  });

  it("preserves dashboard filters when moving to a neighbour", async () => {
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: null,
      next: {
        id: "receipt-2",
        merchant: "Next Merchant",
        date: "2026-02-02",
      },
    });

    renderViewReceipt("/receipt/receipt-1?q=groceries&tab=reviewed&page=2");

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(mocks.fetchReceiptById).toHaveBeenCalledWith(
        "receipt-2",
        expect.anything()
      );
    });
    expect(screen.getByTestId("location").textContent).toBe(
      "/receipt/receipt-2?q=groceries&tab=reviewed&page=2"
    );
  });

  it("moves to the previous uploaded receipt", async () => {
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: {
        id: "receipt-0",
        merchant: "Previous Merchant",
        date: "2026-01-31",
      },
      next: null,
    });

    renderViewReceipt("/receipt/receipt-1");

    await userEvent.click(
      await screen.findByRole("button", { name: "Previous" })
    );

    await waitFor(() => {
      expect(mocks.fetchReceiptById).toHaveBeenCalledWith(
        "receipt-0",
        expect.anything()
      );
    });
  });

  it("replaces history when moving between receipts so Back does not replay them", async () => {
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: null,
      next: {
        id: "receipt-2",
        merchant: "Next Merchant",
        date: "2026-02-02",
      },
    });

    renderViewReceipt("/receipt/receipt-1");

    expect(await screen.findByTestId("navigation-type")).toHaveTextContent("POP");

    await userEvent.click(
      await screen.findByRole("button", { name: "Next" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigation-type")).toHaveTextContent("REPLACE");
    });
  });

  it("ignores a neighbour that points at the current receipt", async () => {
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: null,
      next: {
        id: "receipt-1",
        merchant: "Same Merchant",
        date: "2026-02-01",
      },
    });

    renderViewReceipt("/receipt/receipt-1");

    await userEvent.click(
      await screen.findByRole("button", { name: "Next" })
    );

    expect(mocks.fetchReceiptById).toHaveBeenCalledTimes(1);
    expect(mocks.fetchReceiptById).toHaveBeenCalledWith(
      "receipt-1",
      expect.anything()
    );
  });

  it("confirms navigation away from unsaved edits", async () => {
    mocks.fetchReceiptNeighbors.mockResolvedValue({
      previous: null,
      next: {
        id: "receipt-2",
        merchant: "Next Merchant",
        date: "2026-02-02",
      },
    });
    vi.spyOn(window, "confirm").mockImplementation(() => false);

    renderViewReceipt("/receipt/receipt-1");
    await screen.findByRole("button", { name: "Next" });
    await userEvent.click(screen.getByRole("button", { name: "Mark Dirty" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(window.confirm).toHaveBeenCalledWith("Discard changes?");
    expect(mocks.fetchReceiptById).toHaveBeenCalledTimes(1);
  });

  it("disables the neighbour buttons when there are none", async () => {
    renderViewReceipt("/receipt/receipt-1");

    expect(
      await screen.findByRole("button", { name: "Previous" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
