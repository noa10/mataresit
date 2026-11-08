/**
 * Resolve the service-role key for an Edge Function.
 *
 * The injected SUPABASE_SERVICE_ROLE_KEY is the supported path while the
 * project still has legacy JWT keys enabled. SERVICE_ROLE_KEY is only a
 * fallback for functions whose runtime does not inject the built-in variable.
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
  const builtIn = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (builtIn) return builtIn;

  const explicit = Deno.env.get('SERVICE_ROLE_KEY')?.trim();
  return explicit || undefined;
}
