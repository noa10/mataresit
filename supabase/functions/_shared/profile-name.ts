/**
 * Name fields that actually exist on the hosted public.profiles table.
 *
 * The hosted database has first_name/last_name/email and no full_name column,
 * so PostgREST rejects any select that asks for profiles.full_name.
 */
export interface ProfileNameFields {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/**
 * Derive a display name exactly like the billing schema restore migration:
 * COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), email)
 *
 * Returns null when the profile is missing and has no email, matching the SQL
 * COALESCE result, so callers can store it in email template data as-is.
 */
export function deriveDisplayName(
  profile: ProfileNameFields | null | undefined,
): string | null {
  if (!profile) {
    return null;
  }

  // CONCAT_WS skips null parts; PostgreSQL TRIM only strips spaces.
  const name = [profile.first_name, profile.last_name]
    .filter((part): part is string => part != null)
    .join(' ')
    .replace(/^ +| +$/g, '');

  return (name || profile.email) ?? null;
}
