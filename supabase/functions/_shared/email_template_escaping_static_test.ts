// Guards the email templates against re-introducing an unescaped user-supplied
// value into an HTML body.
//
// The fields below are written by end users: profile names and team names
// through the profile and team editors, free-text reasons and comments through
// the claim and removal flows. A direct PostgREST write bypasses the client-side
// length and format checks, so any of them can carry markup. Unescaped, that
// markup and any links in it are delivered inside mail sent from the platform's
// own sender domain.
//
// The same values are interpolated into plain-text bodies, where escaping would
// show up literally, so the rule is per sink: HTML sinks must escape,
// plain-text sinks must not.

const templateUrls = {
  'templates.ts': new URL('../send-email/templates.ts', import.meta.url),
  'billing-templates.ts': new URL('../send-email/billing-templates.ts', import.meta.url),
} as const;

// Fields whose value an end user can set. Keep this list in step with the
// templates: a new user-writable field that reaches an HTML body belongs here.
const USER_CONTROLLED_FIELDS = [
  'recipientName',
  'teamName',
  'inviterName',
  'role',
  'removedUserName',
  'removedByUserName',
  'removedByUserEmail',
  'removalReason',
  'transferredToUserName',
] as const;

const HTML_LINE = /<[a-z][a-z0-9]*[\s>/]/i;

Deno.test('no HTML body interpolates a user-controlled field without escaping it', async () => {
  const offenders: string[] = [];

  for (const [name, url] of Object.entries(templateUrls)) {
    const source = await Deno.readTextFile(url);

    for (const [index, line] of source.split('\n').entries()) {
      if (!HTML_LINE.test(line)) continue;

      for (const field of USER_CONTROLLED_FIELDS) {
        if (!line.includes('${data.' + field + '}')) continue;
        offenders.push(`${name}:${index + 1}: ${field} — ${line.trim()}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `User-controlled value interpolated into an HTML body without escapeHtml:\n${offenders.join('\n')}`,
    );
  }
});

Deno.test('every title element escapes the interpolated subject', async () => {
  const offenders: string[] = [];

  for (const [name, url] of Object.entries(templateUrls)) {
    const source = await Deno.readTextFile(url);

    for (const [index, line] of source.split('\n').entries()) {
      // Subjects are built by interpolating the same user-controlled values
      // (team name, actor name, merchant) and then dropped into <title>, so
      // they need escaping at the sink even though the header itself must not
      // be escaped.
      if (line.includes('<title>${subject}</title>')) {
        offenders.push(`${name}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `Unescaped subject in a title element:\n${offenders.join('\n')}`,
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
    .filter((line) => line.includes('${escapeHtml(data.recipientName)}') && !HTML_LINE.test(line));

  if (escapedInText.length > 0) {
    throw new Error(
      `Plain-text bodies must not HTML-escape the name:\n${escapedInText.map((l) => l.trim()).join('\n')}`,
    );
  }
});
