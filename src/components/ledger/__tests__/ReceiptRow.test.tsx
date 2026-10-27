import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReceiptRow } from "@/components/ledger/ReceiptRow";
import type { WorkspaceReceiptSummary } from "@/services/dashboardSummaryService";

vi.mock("@/contexts/LanguageContext", () => ({
  useDashboardTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const receipt: WorkspaceReceiptSummary = {
  id: "receipt-1",
  merchant: "Kedai Kopi",
  date: "2026-10-20",
  total: 18.5,
  currency: "MYR",
  status: "unreviewed",
  category: "Meals",
  confidence: 0.92,
};

describe("ReceiptRow selection accessibility", () => {
  it("exposes selection rows as checkboxes with their checked state", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();

    render(
      <ReceiptRow
        receipt={receipt}
        selectable
        selected={false}
        onToggleSelect={onToggleSelect}
      />
    );

    const row = screen.getByRole("checkbox");
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(row).toHaveAttribute("tabindex", "0");

    await user.click(row);
    expect(onToggleSelect).toHaveBeenCalledWith("receipt-1", true);
  });

  it("keeps the open action as a focusable button outside selection mode", () => {
    render(<ReceiptRow receipt={receipt} onOpen={vi.fn()} />);

    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).not.toHaveAttribute("aria-checked");
  });
});
