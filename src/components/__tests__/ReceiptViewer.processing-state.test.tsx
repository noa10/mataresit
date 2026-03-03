import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";

import ReceiptViewer from "@/components/ReceiptViewer";
import { ReceiptWithDetails } from "@/types/receipt";

const mocks = vi.hoisted(() => ({
  fetchCategoriesForDisplay: vi.fn(),
  updateReceipt: vi.fn(),
  updateReceiptWithLineItems: vi.fn(),
  processReceiptWithAI: vi.fn(),
  logCorrections: vi.fn(),
  fixProcessingStatus: vi.fn(),
  subscribeToReceiptAll: vi.fn(),
  cancelReceiptProcessing: vi.fn(),
  recoverStuckReceiptProcessing: vi.fn(),
  getStoredProcessingSettings: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
  saveReceipt: vi.fn(() => "save-op-1"),
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: any) =>
    children({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetTransform: vi.fn(),
      setTransform: vi.fn(),
      instance: {
        transformState: {
          scale: 1,
          positionX: 0,
          positionY: 0,
        },
      },
    }),
  TransformComponent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useReceiptsTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({ currentTeam: null }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      selectedModel: "gemini-2.5-flash-lite",
    },
  }),
  getStoredProcessingSettings: mocks.getStoredProcessingSettings,
}));

vi.mock("@/contexts/SaveStatusContext", () => ({
  useSaveStatus: () => ({
    saveReceipt: mocks.saveReceipt,
  }),
  useReceiptSaveStatus: () => ({
    isSaving: false,
    status: "idle",
  }),
}));

vi.mock("@/components/SaveStatusToastManager", () => ({
  SaveStatusIndicator: () => null,
}));

vi.mock("@/services/categoryService", () => ({
  fetchCategoriesForDisplay: mocks.fetchCategoriesForDisplay,
}));

vi.mock("@/services/categoryRuleService", () => ({
  upsertCategoryRule: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@/services/receiptService", () => ({
  updateReceipt: mocks.updateReceipt,
  updateReceiptWithLineItems: mocks.updateReceiptWithLineItems,
  processReceiptWithAI: mocks.processReceiptWithAI,
  logCorrections: mocks.logCorrections,
  fixProcessingStatus: mocks.fixProcessingStatus,
  subscribeToReceiptAll: mocks.subscribeToReceiptAll,
  cancelReceiptProcessing: mocks.cancelReceiptProcessing,
  recoverStuckReceiptProcessing: mocks.recoverStuckReceiptProcessing,
  normalizeReceiptProcessingStatus: (status: string | null | undefined) => {
    if (!status) return "complete";
    const normalized = status.toLowerCase();
    if (normalized === "processing_ai") return "processing";
    if (normalized === "completed") return "complete";
    return normalized;
  },
  isActiveReceiptProcessingStatus: (status: string | null | undefined) =>
    ["uploading", "uploaded", "processing"].includes((status || "").toLowerCase()),
}));

vi.mock("@/components/categories/CategorySelector", () => ({
  CategorySelector: () => <div data-testid="category-selector" />,
}));

vi.mock("@/components/paidby/PaidBySelector", () => ({
  PaidBySelector: () => <div data-testid="paidby-selector" />,
}));

vi.mock("@/components/receipts/ReceiptHistoryModal", () => ({
  ReceiptHistoryModal: () => null,
}));

vi.mock("@/components/search/SimilarReceipts", () => ({
  SimilarReceipts: () => null,
}));

vi.mock("@/components/claims/ClaimFromReceiptButton", () => ({
  ClaimFromReceiptButton: () => null,
}));

vi.mock("@/components/ui/OptimizedImage", () => ({
  ReceiptViewerImage: React.forwardRef<HTMLImageElement, any>((props, ref) => (
    <img ref={ref} {...props} />
  )),
}));

vi.mock("@/components/receipts/BoundingBoxOverlay", () => ({
  default: () => null,
}));

vi.mock("@/components/receipts/DocumentStructureViewer", () => ({
  default: () => null,
}));

vi.mock("@/components/receipts/VisualizationSettings", () => ({
  default: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
    warning: mocks.toastWarning,
  },
}));

const baseReceipt: ReceiptWithDetails = {
  id: "receipt-1",
  merchant: "Processing...",
  date: "2026-02-28",
  total: 0,
  payment_method: "",
  status: "unreviewed",
  created_at: "2026-02-28T00:00:00.000Z",
  updated_at: "2026-02-28T00:00:00.000Z",
  currency: "MYR",
  image_url: "https://example.com/receipt.jpg",
  lineItems: [],
  processing_status: "processing",
  processing_error: null,
};

function renderViewer(receipt: ReceiptWithDetails) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <ReceiptViewer receipt={receipt} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("ReceiptViewer processing state behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getStoredProcessingSettings.mockReturnValue(null);

    mocks.fetchCategoriesForDisplay.mockResolvedValue([]);
    mocks.updateReceipt.mockResolvedValue(true);
    mocks.updateReceiptWithLineItems.mockResolvedValue(true);
    mocks.processReceiptWithAI.mockResolvedValue(null);
    mocks.logCorrections.mockResolvedValue(true);
    mocks.fixProcessingStatus.mockResolvedValue(true);
    mocks.subscribeToReceiptAll.mockReturnValue(() => {});
    mocks.cancelReceiptProcessing.mockResolvedValue(true);
    mocks.recoverStuckReceiptProcessing.mockResolvedValue({
      recovered: false,
      reason: "fresh_activity",
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "processing_logs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        };
      }

      return {
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });

    mocks.supabase.storage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("shows Stop Processing while status is active", async () => {
    renderViewer({ ...baseReceipt, processing_status: "processing" });

    expect(await screen.findByRole("button", { name: /Stop Processing/i })).toBeInTheDocument();
  });

  it("Stop Processing exits loading state and allows reprocess", async () => {
    const user = userEvent.setup();
    renderViewer({ ...baseReceipt, processing_status: "processing" });

    await user.click(await screen.findByRole("button", { name: /Stop Processing/i }));

    await waitFor(() => {
      expect(mocks.cancelReceiptProcessing).toHaveBeenCalledWith("receipt-1", "Cancelled by user");
      expect(screen.queryByRole("button", { name: /Stop Processing/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reprocess with AI Vision/i })).toBeEnabled();
    });
  });

  it("calls auto-recovery check on mount for processing receipts", async () => {
    renderViewer({ ...baseReceipt, processing_status: "processing" });

    await waitFor(() => {
      expect(mocks.recoverStuckReceiptProcessing).toHaveBeenCalledWith("receipt-1", {
        staleMs: 180000,
      });
    });
  });

  it.each(["failed_ai", "failed_ocr"] as const)(
    "treats %s as terminal failure state (no infinite loading)",
    (status) => {
      renderViewer({ ...baseReceipt, id: `receipt-${status}`, processing_status: status });

      expect(screen.queryByRole("button", { name: /Stop Processing/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Running AI Analysis/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reprocess with AI Vision/i })).toBeEnabled();
    }
  );

  it("uses latest persisted settings model for Reprocess with AI Vision", async () => {
    const user = userEvent.setup();
    renderViewer({ ...baseReceipt, processing_status: "complete" });
    mocks.getStoredProcessingSettings.mockReturnValue({
      selectedModel: "openrouter/meta-llama/llama-4-maverick:free",
    });

    await user.click(screen.getByRole("button", { name: /Reprocess with AI Vision/i }));

    await waitFor(() => {
      expect(mocks.processReceiptWithAI).toHaveBeenCalled();
    });

    const [receiptId, options] = mocks.processReceiptWithAI.mock.calls.at(-1) || [];
    expect(receiptId).toBe("receipt-1");
    expect(mocks.getStoredProcessingSettings).toHaveBeenCalled();
    expect(options).toEqual(
      expect.objectContaining({
        modelId: "openrouter/meta-llama/llama-4-maverick:free",
      })
    );
  });

  it("uses latest persisted settings model for failed-state Try Again", async () => {
    const user = userEvent.setup();
    renderViewer({ ...baseReceipt, processing_status: "failed" });
    mocks.getStoredProcessingSettings.mockReturnValue({
      selectedModel: "gemini-2.5-pro",
    });

    await user.click(screen.getByRole("button", { name: /Try Again/i }));

    await waitFor(() => {
      expect(mocks.processReceiptWithAI).toHaveBeenCalled();
    });

    const [receiptId, options] = mocks.processReceiptWithAI.mock.calls.at(-1) || [];
    expect(receiptId).toBe("receipt-1");
    expect(mocks.getStoredProcessingSettings).toHaveBeenCalled();
    expect(options).toEqual(
      expect.objectContaining({
        modelId: "gemini-2.5-pro",
      })
    );
  });

  it("falls back to hook selected model when persisted settings are missing or invalid", async () => {
    const user = userEvent.setup();
    renderViewer({ ...baseReceipt, processing_status: "complete" });

    await user.click(screen.getByRole("button", { name: /Reprocess with AI Vision/i }));

    await waitFor(() => {
      expect(mocks.processReceiptWithAI).toHaveBeenCalled();
    });

    const [receiptId, options] = mocks.processReceiptWithAI.mock.calls.at(-1) || [];
    expect(receiptId).toBe("receipt-1");
    expect(options).toEqual(
      expect.objectContaining({
        modelId: "gemini-2.5-flash-lite",
      })
    );
  });
});
