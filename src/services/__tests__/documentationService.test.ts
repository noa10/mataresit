import { beforeEach, describe, expect, it, vi } from "vitest";

import { documentationService } from "@/services/documentationService";
import { markdownLoader } from "@/services/markdownLoader";

const fetchMock = vi.fn();

const response = (ok: boolean, content = "") => ({
  ok,
  status: ok ? 200 : 404,
  statusText: ok ? "OK" : "Not Found",
  text: async () => content,
});

describe("documentationService localization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    documentationService.clearCache();
    markdownLoader.clearCache();
    localStorage.clear();
  });

  it("localizes guide metadata and navigation for Malay", async () => {
    const structure = await documentationService.getDocumentationStructure("ms");

    expect(structure.categories[0].title).toBe("Bermula");
    expect(structure.categories[0].guides[0].title).toBe("Mula Pantas 5 Minit");
    expect(structure.quickStart[0].title).toBe("Mula Pantas 5 Minit");
  });

  it("falls back to the English guide body when the Malay markdown is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async (path: string) => {
      if (path.includes("/ms/")) return response(false);
      if (path.includes("/en/onboarding/quick-start-5min.md")) {
        return response(true, "# Quick start");
      }
      return response(false);
    });

    const guide = await documentationService.getGuide("quick-start-5min", "ms");

    expect(guide?.title).toBe("Mula Pantas 5 Minit");
    expect(guide?.content).toBe("# Quick start");
    expect(guide?.contentFallback).toBe(true);
    expect(guide?.sourcePath).toBe("/docs/user-guides/en/onboarding/quick-start-5min.md");

    consoleError.mockRestore();
  });

  it("loads the localized body without a fallback notice when a translation exists", async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path.includes("/en/onboarding/quick-start-5min.md")
        ? response(true, "# Quick start")
        : response(false)
    );

    const guide = await documentationService.getGuide("quick-start-5min", "en");

    expect(guide?.title).toBe("5-Minute Quick Start");
    expect(guide?.content).toBe("# Quick start");
    expect(guide?.contentFallback).toBe(false);
  });
});
