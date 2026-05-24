import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DuplicateDetectionPanel } from "@/components/dashboard/DuplicateDetectionPanel";
import { DuplicateScanConfig } from "@/components/dashboard/DuplicateScanConfig";
import { DuplicateGroupCard } from "@/components/dashboard/DuplicateGroupCard";
import {
  useDuplicateScan,
  useDuplicateDelete,
  useDuplicateCheckedState,
} from "@/hooks/useDuplicateDetection";
import type { ScanConfig, ScanResult, DuplicateGroup } from "@/types/duplicateDetection";
import type { Receipt } from "@/types/receipt";

// ---------------------------------------------------------------------------
// Hoisted mocks — referenced in both vi.mock() and test bodies
// ---------------------------------------------------------------------------

// Override setup-file mocks that use vi.fn() (not a proper constructor).
// Radix UI FocusScope uses MutationObserver with `new`, which requires a real constructor.
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
};
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

const mocks = vi.hoisted(() => ({
  mockScan: vi.fn(),
  mockReset: vi.fn(),
  mockDeleteSelected: vi.fn(),
  mockDeleteAllKeepOldest: vi.fn(),
  mockToggleReceipt: vi.fn(),
  mockSelectAll: vi.fn(),
  mockDeselectAll: vi.fn(),
  mockKeptIds: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/useDuplicateDetection", () => ({
  useDuplicateScan: vi.fn(),
  useDuplicateDelete: vi.fn(),
  useDuplicateCheckedState: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const baseReceipt: Receipt = {
  id: "",
  merchant: "Starbucks",
  date: "2024-01-15",
  total: 12.5,
  currency: "USD",
  payment_method: "credit_card",
  status: "reviewed",
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
};

const receipt1: Receipt = { ...baseReceipt, id: "receipt-1" };
const receipt2: Receipt = { ...baseReceipt, id: "receipt-2" };

const mockGroup: DuplicateGroup = {
  id: "group-1",
  matchCriteria: "merchant + date + total",
  keptReceiptId: "receipt-1",
  receipts: [receipt1, receipt2],
};

const mockScanResult: ScanResult = {
  groups: [mockGroup],
  totalDuplicates: 1,
  scannedCount: 100,
  scannedAt: "2024-01-15T10:00:00Z",
};

const defaultConfig: ScanConfig = {
  merchantEnabled: true,
  dateEnabled: true,
  dateToleranceDays: 0,
  totalEnabled: true,
  totalTolerance: 0.01,
  taxEnabled: false,
  currencyEnabled: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel() {
  return render(
    <MemoryRouter>
      <DuplicateDetectionPanel />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DuplicateDetectionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: null,
      isLoading: false,
      error: null,
      reset: mocks.mockReset,
    });

    vi.mocked(useDuplicateDelete).mockReturnValue({
      deleteSelected: mocks.mockDeleteSelected,
      deleteAllKeepOldest: mocks.mockDeleteAllKeepOldest,
      isDeleting: false,
    });

    vi.mocked(useDuplicateCheckedState).mockReturnValue({
      checkedIds: new Set<string>(),
      selectedCount: 0,
      toggleReceipt: mocks.mockToggleReceipt,
      selectAll: mocks.mockSelectAll,
      deselectAll: mocks.mockDeselectAll,
      keptIds: mocks.mockKeptIds,
    });
  });

  // -----------------------------------------------------------------------
  // 1. Renders "Scan for Duplicates" button
  // -----------------------------------------------------------------------
  it("renders the scan button", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "scanButton" })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Scan button triggers scan when clicked
  // -----------------------------------------------------------------------
  it("calls scan with config when scan button is clicked", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "scanButton" }));
    expect(mocks.mockScan).toHaveBeenCalledTimes(1);
    expect(mocks.mockScan).toHaveBeenCalledWith(expect.objectContaining(defaultConfig));
  });

  // -----------------------------------------------------------------------
  // 3. Loading state shows spinner
  // -----------------------------------------------------------------------
  it("shows spinner and scanning text when isLoading is true", () => {
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: null,
      isLoading: true,
      error: null,
      reset: mocks.mockReset,
    });

    renderPanel();
    // "scanning" appears both in the button and the loading indicator
    const scanningElements = screen.getAllByText("scanning");
    expect(scanningElements.length).toBeGreaterThanOrEqual(2);
  });

  // -----------------------------------------------------------------------
  // 4. Results display group cards when scan returns data
  // -----------------------------------------------------------------------
  it("renders group cards and summary when scan data is returned", () => {
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: mockScanResult,
      isLoading: false,
      error: null,
      reset: mocks.mockReset,
    });

    renderPanel();

    // Summary text
    expect(screen.getByText("foundDuplicates")).toBeInTheDocument();

    // Group header with match criteria (text is split across child nodes)
    expect(
      screen.getByText((content) => content.startsWith("groupLabel")),
    ).toBeInTheDocument();

    // Action bar buttons (text includes count, so use role matcher)
    expect(screen.getByRole("button", { name: /deleteSelected/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deleteAllKeepOldest/ })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 5. Empty state shown when scan returns 0 groups
  // -----------------------------------------------------------------------
  it("shows empty state when scan returns zero groups", () => {
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: { groups: [], totalDuplicates: 0, scannedCount: 100, scannedAt: "2024-01-15T10:00:00Z" },
      isLoading: false,
      error: null,
      reset: mocks.mockReset,
    });

    renderPanel();
    expect(screen.getByText("noDuplicates")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 6. Error state shown when scan fails
  // -----------------------------------------------------------------------
  it("shows error alert when scan fails", () => {
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: null,
      isLoading: false,
      error: new Error("Scan failed"),
      reset: mocks.mockReset,
    });

    renderPanel();
    expect(screen.getByText("Scan failed")).toBeInTheDocument();
    // Two scanButton instances: header button + retry button in error alert
    const scanButtons = screen.getAllByRole("button", { name: "scanButton" });
    expect(scanButtons).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // 7. "Delete Selected" button disabled when nothing checked
  // -----------------------------------------------------------------------
  it("disables delete selected button when selectedCount is 0", () => {
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: mockScanResult,
      isLoading: false,
      error: null,
      reset: mocks.mockReset,
    });

    renderPanel();

    // The delete selected button text includes the count: "deleteSelected (0)"
    const deleteBtn = screen.getByRole("button", { name: /deleteSelected/ });
    expect(deleteBtn).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // 8. Confirmation dialog opens on delete button click
  // -----------------------------------------------------------------------
  it("opens confirmation dialog when delete selected is clicked with checked items", () => {
    vi.mocked(useDuplicateScan).mockReturnValue({
      scan: mocks.mockScan,
      data: mockScanResult,
      isLoading: false,
      error: null,
      reset: mocks.mockReset,
    });

    vi.mocked(useDuplicateCheckedState).mockReturnValue({
      checkedIds: new Set(["receipt-2"]),
      selectedCount: 1,
      toggleReceipt: mocks.mockToggleReceipt,
      selectAll: mocks.mockSelectAll,
      deselectAll: mocks.mockDeselectAll,
      keptIds: mocks.mockKeptIds,
    });

    renderPanel();

    // Click the delete selected button
    const deleteBtn = screen.getByRole("button", { name: /deleteSelected/ });
    expect(deleteBtn).not.toBeDisabled();
    fireEvent.click(deleteBtn);

    // Confirmation dialog should be visible
    expect(screen.getByText("confirmDeleteSelectedTitle")).toBeInTheDocument();
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    expect(screen.getByText("cancel")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DuplicateScanConfig
// ---------------------------------------------------------------------------

describe("DuplicateScanConfig", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  // -----------------------------------------------------------------------
  // 9. Renders all toggle switches
  // -----------------------------------------------------------------------
  it("renders all toggle switches", () => {
    render(<DuplicateScanConfig config={defaultConfig} onChange={onChange} />);

    // Merchant (locked/disabled)
    const merchantSwitch = screen.getByRole("switch", { name: "merchantLabel" });
    expect(merchantSwitch).toBeInTheDocument();
    expect(merchantSwitch).toBeDisabled();
    expect(merchantSwitch).toBeChecked();

    // Date
    expect(screen.getByRole("switch", { name: "dateLabel" })).toBeInTheDocument();

    // Total
    expect(screen.getByRole("switch", { name: "totalLabel" })).toBeInTheDocument();

    // Tax
    expect(screen.getByRole("switch", { name: "taxLabel" })).toBeInTheDocument();

    // Currency
    expect(screen.getByRole("switch", { name: "currencyLabel" })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 10. Toggling Date shows/hides tolerance input
  // -----------------------------------------------------------------------
  it("shows date tolerance input when dateEnabled is true and hides it when false", () => {
    // Render with dateEnabled: true
    const { rerender } = render(
      <DuplicateScanConfig config={defaultConfig} onChange={onChange} />,
    );

    // Tolerance input should be visible
    expect(screen.getByLabelText("dateToleranceLabel")).toBeInTheDocument();

    // Re-render with dateEnabled: false
    rerender(
      <DuplicateScanConfig
        config={{ ...defaultConfig, dateEnabled: false }}
        onChange={onChange}
      />,
    );

    // Tolerance input should be hidden
    expect(screen.queryByLabelText("dateToleranceLabel")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 11. Toggling Total shows/hides tolerance input
  // -----------------------------------------------------------------------
  it("shows total tolerance input when totalEnabled is true and hides it when false", () => {
    // Render with totalEnabled: true
    const { rerender } = render(
      <DuplicateScanConfig config={defaultConfig} onChange={onChange} />,
    );

    // Tolerance input should be visible
    expect(screen.getByLabelText("totalToleranceLabel")).toBeInTheDocument();

    // Re-render with totalEnabled: false
    rerender(
      <DuplicateScanConfig
        config={{ ...defaultConfig, totalEnabled: false }}
        onChange={onChange}
      />,
    );

    // Tolerance input should be hidden
    expect(screen.queryByLabelText("totalToleranceLabel")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 12. onChange fires with updated config
  // -----------------------------------------------------------------------
  it("calls onChange with updated config when a toggle is switched", () => {
    render(<DuplicateScanConfig config={defaultConfig} onChange={onChange} />);

    // Toggle the date switch off
    fireEvent.click(screen.getByRole("switch", { name: "dateLabel" }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, dateEnabled: false });

    onChange.mockClear();

    // Toggle the tax switch on
    fireEvent.click(screen.getByRole("switch", { name: "taxLabel" }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, taxEnabled: true });
  });
});

// ---------------------------------------------------------------------------
// DuplicateGroupCard
// ---------------------------------------------------------------------------

describe("DuplicateGroupCard", () => {
  const onToggleReceipt = vi.fn();
  const checkedIds = new Set<string>(["receipt-2"]);

  beforeEach(() => {
    onToggleReceipt.mockClear();
  });

  function renderCard(expanded = true) {
    // We control initial expanded state via the component's default (true)
    return render(
      <DuplicateGroupCard
        group={mockGroup}
        groupIndex={0}
        checkedIds={checkedIds}
        onToggleReceipt={onToggleReceipt}
      />,
    );
  }

  // -----------------------------------------------------------------------
  // 13. Renders group header with match criteria
  // -----------------------------------------------------------------------
  it("renders group header with match criteria", () => {
    renderCard();

    // The heading text is split across child text nodes, so use a custom matcher
    const heading = screen.getByText((content) =>
      content.startsWith("groupLabel") && content.includes("merchant + date + total"),
    );
    expect(heading).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 14. Expand/collapse works
  // -----------------------------------------------------------------------
  it("expands and collapses receipt list when header is clicked", () => {
    renderCard();

    // Initially expanded — receipt rows are visible (two receipts, both "Starbucks")
    const receiptNames = screen.getAllByText("Starbucks");
    expect(receiptNames).toHaveLength(2);

    // Click header to collapse
    fireEvent.click(screen.getByRole("button"));

    // Receipt rows should be hidden
    expect(screen.queryAllByText("Starbucks")).toHaveLength(0);

    // Click header again to expand
    fireEvent.click(screen.getByRole("button"));

    // Receipt rows should be visible again
    expect(screen.getAllByText("Starbucks")).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // 15. Checkboxes render with correct initial state
  // -----------------------------------------------------------------------
  it("renders checkboxes with correct checked state", () => {
    renderCard();

    // receipt-2 is in checkedIds, so its checkbox should be checked
    const checkedCheckbox = screen.getByRole("checkbox", { name: "Starbucks - 12.5" });
    expect(checkedCheckbox).toBeChecked();
  });

  // -----------------------------------------------------------------------
  // 16. Kept receipt checkbox is disabled
  // -----------------------------------------------------------------------
  it("disables the kept receipt checkbox", () => {
    renderCard();

    // receipt-1 is the kept receipt — its aria-label is "keptLabel"
    const keptCheckbox = screen.getByRole("checkbox", { name: "keptLabel" });
    expect(keptCheckbox).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // 17. onToggleReceipt fires on checkbox click
  // -----------------------------------------------------------------------
  it("calls onToggleReceipt when a non-kept checkbox is clicked", () => {
    renderCard();

    // Click the non-kept checkbox (receipt-2)
    const checkbox = screen.getByRole("checkbox", { name: "Starbucks - 12.5" });
    fireEvent.click(checkbox);

    expect(onToggleReceipt).toHaveBeenCalledTimes(1);
    expect(onToggleReceipt).toHaveBeenCalledWith("receipt-2", false);
  });
});
