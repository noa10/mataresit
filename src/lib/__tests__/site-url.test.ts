import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const CANONICAL_ORIGIN = "https://mataresit.com";

describe("canonical origin", () => {
  it("uses the production domain in index.html metadata", () => {
    const html = read("index.html");

    expect(html).toContain(`<link rel="canonical" href="${CANONICAL_ORIGIN}/" />`);
    expect(html).toContain(`<meta property="og:url" content="${CANONICAL_ORIGIN}/" />`);
    expect(html).toContain(`<meta property="og:image" content="${CANONICAL_ORIGIN}/`);
    expect(html).toContain(`<meta name="twitter:image" content="${CANONICAL_ORIGIN}/`);
    expect(html).not.toContain("mataresit.vercel.app");
  });

  it("points robots.txt and every sitemap entry at the production domain", () => {
    expect(read("public/robots.txt")).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`);

    const sitemap = read("public/sitemap.xml");
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      expect(location.startsWith(`${CANONICAL_ORIGIN}/`)).toBe(true);
    }
  });
});
