import { beforeEach, describe, expect, it, vi } from "vitest";

import { documentationService } from "@/services/documentationService";
import { markdownLoader } from "@/services/markdownLoader";

const fetchMock = vi.fn();

const response = (ok: boolean, content = "", contentType = "text/markdown") => ({
  ok,
  status: ok ? 200 : 404,
  statusText: ok ? "OK" : "Not Found",
  headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) },
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
    expect(guide?.sourcePath).toBe("/docs/user-guides/en/onboarding/quick-start-5min.md");
  });

  it("does not claim an English fallback or expose a source when neither language has markdown", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(response(false));

    const guide = await documentationService.getGuide("quick-start-5min", "ms");

    expect(guide?.content).toContain("placeholder");
    expect(guide?.contentFallback).toBe(false);
    expect(guide?.sourcePath).toBeUndefined();

    consoleError.mockRestore();
  });

  it("does not expose a source when the requested English markdown is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(response(false));

    const guide = await documentationService.getGuide("quick-start-5min", "en");

    expect(guide?.content).toContain("placeholder");
    expect(guide?.contentFallback).toBe(false);
    expect(guide?.sourcePath).toBeUndefined();

    consoleError.mockRestore();
  });

  it("treats the SPA index.html as a miss instead of rendering it as guide content", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // A missing markdown file is served by the SPA catch-all rewrite as index.html.
    fetchMock.mockImplementation(async (path: string) =>
      path.includes("/ms/")
        ? response(true, '<!DOCTYPE html><html><head><link rel="stylesheet" href="/x" /></head></html>', "text/html")
        : response(true, "# Quick start")
    );

    const guide = await documentationService.getGuide("quick-start-5min", "ms");

    expect(guide?.content).toBe("# Quick start");
    expect(guide?.content).not.toContain("stylesheet");
    expect(guide?.contentFallback).toBe(true);
    expect(guide?.sourcePath).toBe("/docs/user-guides/en/onboarding/quick-start-5min.md");

    consoleError.mockRestore();
  });

  it("rejects an HTML body even when the content-type header is wrong", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async () =>
      response(true, '<!doctype html><html><body><div id="root"></div></body></html>', "text/markdown")
    );

    const loaded = await markdownLoader.loadMarkdown("/docs/user-guides/ms/missing.md");

    expect(loaded.fallback).toBe(true);
    expect(loaded.content).not.toContain("root");

    consoleError.mockRestore();
  });

  it("serves a real Malay body for every guide that has source markdown", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    fetchMock.mockImplementation(async (path: string) => {
      try {
        return response(true, readFileSync(join(process.cwd(), "public", path), "utf8"));
      } catch {
        return response(false);
      }
    });

    const structure = await documentationService.getDocumentationStructure("ms");
    const guides = structure.categories.flatMap((category) => category.guides);
    const withSource = guides.filter((guide) =>
      existsSync(join(process.cwd(), "public", guide.path.replace("/ms/", "/en/")))
    );

    expect(withSource.length).toBeGreaterThan(0);

    for (const guide of withSource) {
      const loaded = await documentationService.getGuide(guide.id, "ms");

      expect(loaded?.contentFallback, `${guide.id} has no Malay translation`).toBe(false);
      expect(loaded?.sourcePath).toBe(guide.path);
      expect(loaded?.content?.trim().startsWith("#")).toBe(true);
    }
  });
});
