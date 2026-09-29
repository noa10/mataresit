const DEFAULT_SITE_URL = "https://mataresit.vercel.app";

const stripTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, "");

const isLocalHostname = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";

const getConfiguredSiteUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
  return stripTrailingSlash(configuredUrl || DEFAULT_SITE_URL);
};

/**
 * Return the public application origin used for server-generated links.
 * Local browser sessions always keep their local origin, even when a production
 * VITE_SITE_URL is present in the environment.
 */
export const getSiteUrl = (): string => {
  if (typeof window !== "undefined") {
    if (isLocalHostname(window.location.hostname)) {
      return stripTrailingSlash(window.location.origin);
    }

    const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
    if (configuredUrl) {
      return stripTrailingSlash(configuredUrl);
    }

    return stripTrailingSlash(window.location.origin);
  }

  return getConfiguredSiteUrl();
};

/**
 * Return the current browser origin for authentication redirects. Keeping the
 * browser origin makes local and preview deployments return to the host that
 * initiated the flow.
 */
export const getBrowserOrigin = (): string => {
  if (typeof window !== "undefined") {
    return stripTrailingSlash(window.location.origin);
  }

  return getConfiguredSiteUrl();
};

export const getAuthRedirectUrl = (path = "/auth"): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBrowserOrigin()}${normalizedPath}`;
};
