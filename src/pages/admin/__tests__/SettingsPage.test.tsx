import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminSettingsPage from "@/pages/admin/SettingsPage";

const mocks = vi.hoisted(() => ({
  resetSettings: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useAdminTranslation: () => ({
    language: "en",
    t: (key: string) =>
      ({
        "settingsPage.title": "Admin Settings",
        "settingsPage.description":
          "Manage AI processing, model providers, embeddings and platform integrations.",
        "settingsPage.aiProcessing": "AI Processing",
        "settingsPage.aiProcessingDescription":
          "Choose the AI model and batch behaviour used to process receipts.",
        "settingsPage.batchProcessing": "Batch processing",
        "settingsPage.resetDefaults": "Reset to defaults",
        "settingsPage.resetTitle": "Reset processing settings?",
        "settingsPage.resetDescription":
          "This will restore the default processing and batch upload settings.",
        "settingsPage.cancel": "Cancel",
        "settingsPage.continue": "Continue",
        "settingsPage.resetToast": "Processing settings reset.",
        "settingsPage.embeddings": "Embedding Management",
        "settingsPage.embeddingsDescription":
          "Generate and manage vector embeddings for semantic search functionality. Embeddings enable intelligent search across receipts and line items.",
        "settingsPage.stripe": "Stripe Integration Testing",
        "settingsPage.stripeDescription":
          "Test and validate Stripe payment integration functionality including checkout sessions and webhooks.",
      })[key] ?? key,
  }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      selectedModel: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
      batchUpload: {
        maxConcurrent: 2,
        autoStart: false,
        timeoutSeconds: 120,
        maxRetries: 2,
      },
      skipUploadOptimization: true,
      userApiKeys: {},
    },
    updateSettings: vi.fn(),
    resetSettings: mocks.resetSettings,
  }),
}));

vi.mock("@/components/upload/ReceiptProcessingOptions", () => ({
  ReceiptProcessingOptions: () => <div data-testid="receipt-processing-options" />,
}));

vi.mock("@/components/upload/BatchUploadSettings", () => ({
  BatchUploadSettings: () => <div data-testid="batch-upload-settings" />,
}));

vi.mock("@/components/settings/ModelProviderStatus", () => ({
  ModelProviderStatus: () => <div data-testid="model-provider-status" />,
}));

vi.mock("@/components/admin/ReceiptEmbeddingsCard", () => ({
  ReceiptEmbeddingsCard: () => <div data-testid="receipt-embeddings" />,
}));

vi.mock("@/components/admin/LineItemEmbeddingsCard", () => ({
  LineItemEmbeddingsCard: () => <div data-testid="line-item-embeddings" />,
}));

vi.mock("@/components/admin/StripeTestingCard", () => ({
  StripeTestingCard: () => <div data-testid="stripe-testing" />,
}));

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    mocks.resetSettings.mockReset();
  });

  it("hosts the processing and AI provider controls", () => {
    render(<AdminSettingsPage />);

    expect(
      screen.getByRole("heading", { name: "AI Processing" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("receipt-processing-options")).toBeInTheDocument();
    expect(screen.getByTestId("batch-upload-settings")).toBeInTheDocument();
    expect(screen.getByTestId("model-provider-status")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-embeddings")).toBeInTheDocument();
    expect(screen.getByTestId("stripe-testing")).toBeInTheDocument();
  });

  it("resets processing settings from the admin page", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsPage />);

    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));

    expect(mocks.resetSettings).toHaveBeenCalledTimes(1);
  });
});
