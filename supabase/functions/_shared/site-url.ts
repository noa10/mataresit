const DEFAULT_SITE_URL = "https://mataresit.vercel.app";
const LOCAL_SITE_URL = "http://localhost:5173";

const getDefaultSiteUrl = (): string => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("VITE_SUPABASE_URL") || "";

  return supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")
    ? LOCAL_SITE_URL
    : DEFAULT_SITE_URL;
};

const normalizeSiteUrl = (value: string | undefined | null): string => {
  const normalized = value?.trim();
  return (normalized || getDefaultSiteUrl()).replace(/\/+$/, "");
};

const readSiteUrl = (primaryName: string, fallbackName?: string): string => {
  const primaryValue = Deno.env.get(primaryName);
  if (primaryValue?.trim()) {
    return normalizeSiteUrl(primaryValue);
  }

  return normalizeSiteUrl(
    fallbackName ? Deno.env.get(fallbackName) : undefined,
  );
};

/** Public frontend origin used in notification and billing links. */
export const getFrontendUrl = (): string =>
  readSiteUrl("FRONTEND_URL", "SITE_URL");

/** Canonical application origin used in account and invitation links. */
export const getSiteUrl = (): string => readSiteUrl("SITE_URL", "FRONTEND_URL");
