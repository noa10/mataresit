const SHARE_CARD_MIME_TYPE = "image/svg+xml";

export type ShareCardResult = "shared" | "downloaded" | "unsupported";

export interface ShareCardPayload {
  title: string;
  subtitle: string;
  value: string;
  footer: string;
  fileName: string;
  shareText: string;
  accentFrom?: string;
  accentTo?: string;
}

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildShareCardSvg = ({
  title,
  subtitle,
  value,
  footer,
  accentFrom = "#22c55e",
  accentTo = "#0f172a",
}: Omit<ShareCardPayload, "fileName" | "shareText">) => `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardGradient" x1="80" y1="80" x2="1120" y2="550" gradientUnits="userSpaceOnUse">
      <stop stop-color="${accentFrom}" />
      <stop offset="1" stop-color="${accentTo}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="48" fill="#020617" />
  <rect x="32" y="32" width="1136" height="566" rx="40" fill="url(#cardGradient)" opacity="0.95" />
  <rect x="80" y="80" width="1040" height="470" rx="32" fill="#0f172a" fill-opacity="0.84" />
  <text x="120" y="150" fill="#a5f3fc" font-size="28" font-family="Inter, Arial, sans-serif">MataResit Rewards</text>
  <text x="120" y="250" fill="#ffffff" font-size="64" font-weight="700" font-family="Inter, Arial, sans-serif">${escapeSvgText(title)}</text>
  <text x="120" y="330" fill="#cbd5e1" font-size="34" font-family="Inter, Arial, sans-serif">${escapeSvgText(subtitle)}</text>
  <text x="120" y="450" fill="#f8fafc" font-size="90" font-weight="700" font-family="Inter, Arial, sans-serif">${escapeSvgText(value)}</text>
  <text x="120" y="520" fill="#bae6fd" font-size="30" font-family="Inter, Arial, sans-serif">${escapeSvgText(footer)}</text>
</svg>`.trim();

const createShareCardFile = (payload: ShareCardPayload) => {
  const svg = buildShareCardSvg(payload);
  return new File([svg], payload.fileName, { type: SHARE_CARD_MIME_TYPE });
};

const downloadShareCard = (file: File) => {
  if (typeof document === "undefined") return false;

  const downloadUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
  return true;
};

export async function shareAchievementCard(payload: ShareCardPayload): Promise<ShareCardResult> {
  const file = createShareCardFile(payload);

  if (
    typeof navigator !== "undefined"
    && typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: payload.title,
      text: payload.shareText,
    });

    return "shared";
  }

  if (downloadShareCard(file)) {
    return "downloaded";
  }

  return "unsupported";
}