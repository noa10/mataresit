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

describe("canonical origin rollout documentation", () => {
  it("defaults monitoring to the canonical host when APP_DOMAIN is unset", () => {
    const workflow = read(".github/workflows/monitoring.yml");
    const fallbacks = [...workflow.matchAll(/vars\.APP_DOMAIN \|\| '([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(fallbacks.length).toBeGreaterThan(0);
    for (const fallback of fallbacks) {
      expect(fallback).toBe("mataresit.com");
    }
  });

  it("keeps the rollback origin in both OAuth allow-list checklists", () => {
    const oauth = read("docs/GOOGLE_OAUTH_SETUP.md");
    const development = oauth.slice(
      oauth.indexOf("### 1. Supabase Configuration"),
      oauth.indexOf("### 2. Google Cloud Console"),
    );
    const production = oauth.slice(
      oauth.indexOf("### Redirect URLs for Production"),
      oauth.indexOf("### Environment Variables", oauth.indexOf("### Redirect URLs for Production")),
    );

    for (const section of [development, production]) {
      expect(section).toContain("https://mataresit.com");
      expect(section).toContain("https://mataresit.vercel.app");
    }
  });

  it("keeps the swagger source and public copies on the canonical origin", () => {
    for (const path of ["docs/api/swagger-ui.html", "public/docs/api/swagger-ui.html"]) {
      const swagger = read(path);

      expect(swagger).toContain(CANONICAL_ORIGIN);
      expect(swagger).not.toContain("mataresit.vercel.app");
    }
  });

  it("describes the canonical frontend and rollback host as settled", () => {
    const readme = read("docs/README.md");

    expect(readme).toContain(`canonical hosted frontend is [${CANONICAL_ORIGIN}]`);
    expect(readme).toContain("mataresit.vercel.app");
    expect(readme).not.toContain("current temporary hosted frontend");
    expect(readme).not.toContain("when the final canonical domain is selected");
  });
});
