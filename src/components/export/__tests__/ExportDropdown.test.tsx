import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExportDropdown } from "@/components/export/ExportDropdown";
import { Receipt } from "@/types/receipt";

const mocks = vi.hoisted(() => ({
  exportToCSV: vi.fn(),
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
  buildPayerNameMap: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/export", () => ({
  exportToCSV: mocks.exportToCSV,
  exportToExcel: mocks.exportToExcel,
  exportToPDF: mocks.exportToPDF,
}));

vi.mock("@/lib/export/payerNameResolver", () => ({
  buildPayerNameMap: mocks.buildPayerNameMap,
}));

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({ currentTeam: null }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

const sampleReceipts: Receipt[] = [
  {
    id: "receipt-1",
    merchant: "Store A",
    date: "2026-02-10",
    total: 15,
    currency: "MYR",
    status: "reviewed",
    payment_method: "card",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
  },
];

describe("ExportDropdown", () => {
  it("disables export when totalCount is zero", () => {
    render(
      <ExportDropdown
        receipts={sampleReceipts}
        totalCount={0}
      />,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("uses async getReceiptsForExport provider for CSV export", async () => {
    const user = userEvent.setup();
    const fullExportReceipts: Receipt[] = [
      ...sampleReceipts,
      {
        id: "receipt-2",
        merchant: "Store B",
        date: "2026-02-11",
        total: 20,
        currency: "MYR",
        status: "reviewed",
        payment_method: "cash",
        created_at: "2026-02-11T00:00:00Z",
        updated_at: "2026-02-11T00:00:00Z",
      },
    ];

    mocks.buildPayerNameMap.mockResolvedValue(new Map());

    const getReceiptsForExport = vi.fn().mockResolvedValue(fullExportReceipts);

    render(
      <ExportDropdown
        receipts={sampleReceipts}
        totalCount={fullExportReceipts.length}
        getReceiptsForExport={getReceiptsForExport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: /csv/i }));

    await waitFor(() => {
      expect(getReceiptsForExport).toHaveBeenCalledTimes(1);
      expect(mocks.exportToCSV).toHaveBeenCalledWith(fullExportReceipts, undefined, expect.any(Map));
    });
  });
});
