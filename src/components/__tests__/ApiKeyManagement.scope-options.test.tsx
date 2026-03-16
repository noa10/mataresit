import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ApiKeyManagement from "@/components/dashboard/ApiKeyManagement";

const mocks = vi.hoisted(() => ({
  functionsInvoke: vi.fn(),
}));

const settingsResources = {
  apiKeys: {
    scopes: {
      "receipts:read": { name: "Read Receipts", description: "View receipts" },
      "receipts:write": { name: "Write Receipts", description: "Create receipts" },
      "receipts:delete": { name: "Delete Receipts", description: "Delete receipts" },
      "claims:read": { name: "Read Claims", description: "View claims" },
      "claims:write": { name: "Write Claims", description: "Update claims" },
      "claims:delete": { name: "Delete Claims", description: "Delete claims" },
      "profile:read": { name: "Read Profile", description: "Access account profile" },
      "categories:read": { name: "Read Categories", description: "View categories" },
      "gamification:read": { name: "Read Gamification", description: "Access rewards" },
      "search:read": { name: "Search", description: "Perform searches" },
      "analytics:read": { name: "Analytics", description: "Access analytics" },
      "teams:read": { name: "Teams", description: "Access teams" },
      "admin:all": { name: "Admin Access", description: "Full access" },
    },
  },
};

const translationMap: Record<string, string> = {
  "apiKeys.title": "API Key Management",
  "apiKeys.description": "Manage API keys",
  "apiKeys.header.title": "API Keys",
  "apiKeys.header.description": "Manage your API keys for external integrations",
  "apiKeys.header.viewReference": "View API Reference",
  "apiKeys.create.button": "Create API Key",
  "apiKeys.create.title": "Create New API Key",
  "apiKeys.create.description": "Create a new API key",
  "apiKeys.create.fields.nameRequired": "Name *",
  "apiKeys.create.fields.namePlaceholder": "My Integration",
  "apiKeys.create.fields.expires": "Expires (Optional)",
  "apiKeys.create.fields.description": "Description",
  "apiKeys.create.fields.descriptionPlaceholder": "Describe this key",
  "apiKeys.create.fields.accessLevel": "Access Level",
  "apiKeys.create.fields.permissions": "Permissions",
  "apiKeys.create.accessLevels.readOnly": "Read Only",
  "apiKeys.create.accessLevels.readWrite": "Read & Write",
  "apiKeys.create.accessLevels.admin": "Admin",
  "apiKeys.list.empty.title": "No API Keys",
  "apiKeys.list.empty.description": "Create your first API key.",
  "apiKeys.list.empty.action": "Create API Key",
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.functionsInvoke },
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useSettingsTranslation: () => ({
    t: (key: string) => translationMap[key] ?? key,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "en",
      getResourceBundle: (language: string, namespace: string) =>
        language === "en" && namespace === "settings" ? settingsResources : null,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ApiKeyManagement scope options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.functionsInvoke.mockResolvedValue({
      data: { data: { apiKeys: [] } },
      error: null,
    });
  });

  it("includes the new v1 read scopes in create presets and available permissions", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ApiKeyManagement />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.functionsInvoke).toHaveBeenCalledWith("manage-api-keys", { method: "GET" });
    });

    await user.click(screen.getAllByRole("button", { name: "Create API Key" })[0]);

    const profileScope = await screen.findByRole("checkbox", { name: "Read Profile" });
    const categoriesScope = screen.getByRole("checkbox", { name: "Read Categories" });
    const gamificationScope = screen.getByRole("checkbox", { name: "Read Gamification" });

    expect(profileScope).toBeInTheDocument();
    expect(categoriesScope).toBeInTheDocument();
    expect(gamificationScope).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Read Only" }));

    expect(profileScope).toBeChecked();
    expect(categoriesScope).toBeChecked();
    expect(gamificationScope).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Read & Write" }));

    expect(profileScope).toBeChecked();
    expect(categoriesScope).toBeChecked();
    expect(gamificationScope).toBeChecked();
  });
});