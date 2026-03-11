import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildShareCardSvg, shareAchievementCard } from "@/lib/shareCards";

describe("shareCards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds an SVG payload with escaped content", () => {
    const svg = buildShareCardSvg({
      footer: "Track more milestones",
      subtitle: "Earned from scans",
      title: "Level <5>",
      value: "500 & XP",
    });

    expect(svg).toContain("Level &lt;5&gt;");
    expect(svg).toContain("500 &amp; XP");
  });

  it("uses the Web Share API when file sharing is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn().mockReturnValue(true) });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    await expect(shareAchievementCard({
      fileName: "level.svg",
      footer: "Track more milestones",
      shareText: "Level up",
      subtitle: "Earned from scans",
      title: "Level 5",
      value: "500 XP",
    })).resolves.toBe("shared");

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Level 5", text: "Level up" }));
  });

  it("downloads the image fallback when file sharing is unavailable", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn().mockReturnValue(false) });
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn() });

    await expect(shareAchievementCard({
      fileName: "level.svg",
      footer: "Track more milestones",
      shareText: "Level up",
      subtitle: "Earned from scans",
      title: "Level 5",
      value: "500 XP",
    })).resolves.toBe("downloaded");

    expect(click).toHaveBeenCalled();
  });
});