import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfidenceIndicator, normalizeReceiptConfidence } from "@/components/ReceiptViewer";

let translationMode: "normal" | "blank" = "normal";

vi.mock("@/contexts/LanguageContext", () => ({
  useReceiptsTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (translationMode === "blank") return "";

      const map: Record<string, string> = {
        "viewer.highConfidence": "High",
        "viewer.mediumConfidence": "Medium",
        "viewer.lowConfidence": "Low",
        "viewer.veryLowConfidence": "Very Low",
        "viewer.verifiedByUser": "Verified by user",
        "viewer.editToVerify": "Edit this field to verify.",
      };

      if (key === "viewer.aiDetection") {
        const level = String(options?.level ?? "unknown");
        return `AI detection with ${level} confidence`;
      }

      return map[key] ?? key;
    },
  }),
}));

const renderIndicator = (props: ComponentProps<typeof ConfidenceIndicator>) =>
  render(
    <TooltipProvider delayDuration={0}>
      <ConfidenceIndicator {...props} />
    </TooltipProvider>
  );

describe("ReceiptViewer confidence tooltips", () => {
  beforeEach(() => {
    translationMode = "normal";
  });

  it("shows Merchant confidence tooltip on hover with non-empty content", async () => {
    const user = userEvent.setup();
    renderIndicator({ score: 0.92, align: "end", fieldKey: "merchant" });

    await user.hover(screen.getByTestId("confidence-indicator-merchant"));

    const tooltip = await screen.findByTestId("confidence-tooltip-merchant");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("High confidence");
    expect(tooltip).toHaveTextContent("AI detection with high confidence");
  });

  it("shows Line Items confidence tooltip without blank text", async () => {
    const user = userEvent.setup();
    renderIndicator({ score: 0.55, align: "start", fieldKey: "line_items" });

    await user.hover(screen.getByTestId("confidence-indicator-line_items"));

    const tooltip = await screen.findByTestId("confidence-tooltip-line_items");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("uses total confidence as subtotal fallback when subtotal is missing", () => {
    const confidenceWithoutSubtotal = normalizeReceiptConfidence({ total: 88 });
    expect(confidenceWithoutSubtotal.subtotal).toBe(88);

    const confidenceWithSubtotal = normalizeReceiptConfidence({ total: 88, subtotal: 65 });
    expect(confidenceWithSubtotal.subtotal).toBe(65);
  });

  it("falls back to deterministic tooltip text when translations are blank", async () => {
    translationMode = "blank";
    const user = userEvent.setup();
    renderIndicator({ score: 0.72, align: "start", fieldKey: "subtotal" });

    await user.hover(screen.getByTestId("confidence-indicator-subtotal"));

    const tooltip = await screen.findByTestId("confidence-tooltip-subtotal");
    expect(tooltip).toHaveTextContent("Medium confidence");
    expect(tooltip).toHaveTextContent("AI detection with medium confidence");
    expect(tooltip).toHaveTextContent("Edit this field to verify.");
  });
});
