import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GuideDetailPage from "@/pages/GuideDetailPage";
import type { DocumentationGuide } from "@/services/documentationService";

const getGuide = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/services/documentationService", () => ({
  documentationService: { getGuide },
}));

vi.mock("@/components/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const translations: Record<string, string> = {
  "guide.backToDocs": "Back to Docs",
  "guide.notFoundTitle": "Guide not found",
  "guide.notFoundDescription": "The requested guide could not be found or loaded.",
  "guide.loading": "Loading guide…",
  "guide.contentLoadingTitle": "Content loading",
  "guide.contentLoadingDescription": "The guide content is being loaded...",
  "guide.contentFallback":
    "This guide has not been translated into Bahasa Melayu yet. Showing the English version.",
  "guide.readingTime": "{{count}} min read",
  "guide.updated": "Updated {{date}}",
  "guide.quickActions": "Quick Actions",
  "guide.actions.viewSource": "View Source",
  "guide.actions.share": "Share Guide",
  "guide.actions.bookmark": "Bookmark",
  "guide.actions.bookmarked": "Bookmarked",
  "guide.actions.linkCopied": "Link copied to clipboard",
  "guide.actions.copyFailed": "Could not copy the link",
  "guide.actions.bookmarkAdded": "Guide bookmarked",
  "guide.actions.bookmarkRemoved": "Bookmark removed",
  "guide.actions.bookmarkFailed": "Could not update bookmarks",
  "guide.info.title": "Guide Information",
  "guide.info.category": "Category:",
  "guide.info.difficulty": "Difficulty:",
  "guide.info.targetUser": "Target User:",
  "guide.info.readingTime": "Reading Time:",
  "guide.info.lastUpdated": "Last Updated:",
  "guide.info.minutes": "{{count}} minutes",
  "guide.difficulty.beginner": "Beginner",
  "guide.userType.newUser": "New user",
};

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
  useDocumentationTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      let value = translations[key] ?? (options?.defaultValue as string | undefined) ?? key;
      if (options?.count !== undefined) {
        value = value.replace(/{{count}}/g, String(options.count));
      }
      if (options?.date !== undefined) {
        value = value.replace(/{{date}}/g, String(options.date));
      }
      return value;
    },
  }),
}));

const guide: DocumentationGuide = {
  id: "quick-start-5min",
  title: "5-Minute Quick Start",
  description: "Get started with Mataresit in just 5 minutes",
  category: "getting-started",
  path: "/docs/user-guides/en/onboarding/quick-start-5min.md",
  sourcePath: "/docs/user-guides/en/onboarding/quick-start-5min.md",
  content: "# Quick start",
  lastUpdated: "2025-08-02",
  readingTime: 5,
  tags: ["quick-start"],
  difficulty: "beginner",
  userType: "new-user",
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/docs/guide/quick-start-5min"]}>
      <Routes>
        <Route path="/docs/guide/:guideId" element={<GuideDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("GuideDetailPage quick actions", () => {
  beforeEach(() => {
    localStorage.clear();
    getGuide.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    getGuide.mockResolvedValue(guide);
  });

  it("opens the source, copies the link and persists a bookmark", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "5-Minute Quick Start" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Source" }));
    expect(openSpy).toHaveBeenCalledWith(
      "/docs/user-guides/en/onboarding/quick-start-5min.md",
      "_blank",
      "noopener,noreferrer"
    );

    await user.click(screen.getAllByRole("button", { name: "Share Guide" })[1]);
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(toastSuccess).toHaveBeenCalledWith("Link copied to clipboard");

    await user.click(screen.getByText("Bookmark"));

    expect(JSON.parse(localStorage.getItem("mataresit_guide_bookmarks") || "[]")).toEqual([
      "quick-start-5min",
    ]);
    expect(screen.getByText("Bookmarked")).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Guide bookmarked");

    openSpy.mockRestore();
  });

  it("shows the English fallback notice for an untranslated Malay guide", async () => {
    getGuide.mockResolvedValue({ ...guide, contentFallback: true });

    renderPage();

    expect(
      await screen.findByText(
        "This guide has not been translated into Bahasa Melayu yet. Showing the English version."
      )
    ).toBeInTheDocument();
    await waitFor(() => expect(getGuide).toHaveBeenCalledWith("quick-start-5min", "en"));
  });
});
