// Guards the billing email templates against re-introducing an unescaped
// recipient name into an HTML body.
//
// profiles.first_name and profiles.last_name are writable by the account owner
// through the profile editor, and a direct PostgREST write bypasses the client
// side length and format checks. An unescaped name therefore lets a user place
// markup and links inside mail sent from the platform's own sender domain.
//
// The same display name is interpolated into plain-text bodies, where escaping
// would show up literally, so the rule is per sink: HTML sinks must escape,
// plain-text sinks must not.

const templateUrls = {
  'templates.ts': new URL('../send-email/templates.ts', import.meta.url),
  'billing-templates.ts': new URL('../send-email/billing-templates.ts', import.meta.url),
} as const;

const HTML_TAG_BEFORE_NAME = /<[a-z][a-z0-9]*\b[^>]*>\s*(?:Hi|Hai|Hello)\s+\$\{data\.recipientName\}/i;
const HTML_TAG_AFTER_NAME = /\$\{data\.recipientName\}[^<]*<\//;
const ESCAPED = '${escapeHtml(data.recipientName)}';

Deno.test('no HTML template interpolates a recipient name without escaping it', async () => {
  const offenders: string[] = [];

  for (const [name, url] of Object.entries(templateUrls)) {
    const source = await Deno.readTextFile(url);
    const lines = source.split('\n');

    for (const [index, line] of lines.entries()) {
      if (!line.includes('data.recipientName') || line.includes(ESCAPED)) {
        continue;
      }

      if (HTML_TAG_BEFORE_NAME.test(line) || HTML_TAG_AFTER_NAME.test(line)) {
        offenders.push(`${name}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `Recipient name interpolated into an HTML body without escapeHtml:\n${offenders.join('\n')}`,
    );
  }
});

Deno.test('every billing email HTML greeting escapes the recipient name', async () => {
  const source = await Deno.readTextFile(templateUrls['billing-templates.ts']);

  // Two HTML bodies greet by name: subscription expiry and payment confirmation.
  const escaped = source.match(/\$\{escapeHtml\(data\.recipientName\)\}/g) ?? [];
  if (escaped.length < 2) {
    throw new Error(`Expected at least 2 escaped HTML greetings, found ${escaped.length}`);
  }
});

Deno.test('plain-text bodies keep the raw recipient name', async () => {
  const source = await Deno.readTextFile(templateUrls['billing-templates.ts']);

  // A plain-text greeting sits on its own line with no surrounding tag; it must
  // not be escaped, or the recipient sees HTML entities in their inbox.
  const escapedInText = source
    .split('\n')
    .filter((line) => line.includes(ESCAPED) && !/<[a-z]/.test(line));

  if (escapedInText.length > 0) {
    throw new Error(
      `Plain-text bodies must not HTML-escape the name:\n${escapedInText.map((l) => l.trim()).join('\n')}`,
    );
  }
});
