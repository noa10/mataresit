/**
 * HTML escaping for values interpolated into email templates.
 *
 * Recipient display names come from public.profiles, which the account owner
 * can edit through the profile editor. PostgREST writes bypass the client-side
 * length and format checks, so a name can contain markup. Interpolating it
 * straight into an HTML email body lets the sender's own domain carry injected
 * links and images, which is a phishing vector rather than a script vector.
 *
 * Escape at the template sink, not at the source: the same display name is
 * interpolated into plain-text bodies, where HTML entities would show up
 * literally.
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape the five characters that can terminate a text node or attribute.
 *
 * `&` is replaced first so the entities introduced by the later replacements
 * are not escaped again.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) {
    return '';
  }

  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
