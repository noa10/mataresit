/**
 * Resolve the service-role key for an Edge Function.
 *
 * SUPABASE_SERVICE_ROLE_KEY is injected into every Edge Function by the
 * Supabase runtime, so it is the only name this module reads. The legacy
 * SERVICE_ROLE_KEY secret is being retired — reading it hid a duplicate
 * credential that had to be kept in sync by hand.
 *
 * New-format sb_secret_... keys are not a drop-in replacement here: these
 * functions pin supabase-js 2.7.1, which also sends the key as a Bearer token,
 * and the platform rejects a non-JWT bearer for a function with JWT
 * verification enabled. Migrating to sb_secret_... requires upgrading the
 * client and sending the key on the apikey header only.
 *
 * Never log the returned value.
 */
export function getServiceRoleKey(): string | undefined {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || undefined;
}
