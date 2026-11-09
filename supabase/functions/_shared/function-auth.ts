/**
 * Caller authorization for Edge Functions that run with the service-role key.
 *
 * `verify_jwt` only proves that a request carries *a* project JWT; the anon key
 * is one, and it is public. Functions that use the service role internally must
 * therefore decide who is calling. This module classifies a caller as:
 *
 *   - `service_role` — the exact service-role key, matched before JWT parsing.
 *     Internal callers (cron jobs, webhooks, other Edge Functions) use this.
 *   - `admin` — a user JWT whose `user_roles` row is `admin`.
 *   - `user` — any other valid user JWT.
 *
 * Never log the Authorization header or the service-role key.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getServiceRoleKey } from './service-role.ts';

export type CallerRole = 'service_role' | 'admin' | 'user';

export interface Caller {
  role: CallerRole;
  userId?: string;
  /** Address reported by the auth server, never a user-writable profile field. */
  email?: string;
  /** True only when the auth server reports the address as confirmed. */
  emailVerified?: boolean;
}

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Compare two strings without short-circuiting on the first mismatch.
 * The length check is not secret-dependent: key length is not confidential.
 */
export function secureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/**
 * Build a service-role client, or null when the runtime has no service key.
 * Callers should pass an existing client when they already have one.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = getServiceRoleKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolve the caller, or null when the request has no valid credential.
 * A valid user JWT is required for non-service callers; the anon key alone is
 * not a user session.
 */
export async function resolveCaller(
  req: Request,
  adminClient?: SupabaseClient | null,
): Promise<Caller | null> {
  const token = extractBearerToken(req.headers.get('Authorization'));
  if (!token) return null;

  const serviceKey = getServiceRoleKey();
  if (serviceKey && secureEquals(token, serviceKey)) {
    return { role: 'service_role' };
  }

  const admin = adminClient ?? createAdminClient();
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;

    const user = data.user;
    const email = user.email ?? undefined;
    const emailVerified = Boolean(user.email_confirmed_at);

    const { data: adminRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1);

    if (Array.isArray(adminRoles) && adminRoles.length > 0) {
      return { role: 'admin', userId: user.id, email, emailVerified };
    }

    return { role: 'user', userId: user.id, email, emailVerified };
  } catch (error) {
    console.error(
      'Caller resolution failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return null;
  }
}

export function isPrivileged(
  caller: Caller | null,
): caller is Caller & { role: 'service_role' | 'admin' } {
  return caller?.role === 'service_role' || caller?.role === 'admin';
}

export function isSelf(caller: Caller | null, userId: unknown): boolean {
  return Boolean(
    caller?.userId && typeof userId === 'string' && caller.userId === userId,
  );
}

/**
 * Normalize a single email address. Rejects display names, comma/semicolon
 * lists, header injection, and anything that is not exactly one bare address.
 */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/**
 * True only when the recipient is the caller's own address as reported by the
 * auth server and that address is confirmed. `profiles.email` is writable by
 * the user (the "Users can update their own profile" policy has no column
 * restriction), so it must never be used for authorization.
 */
export function callerOwnsEmail(caller: Caller | null, email: string): boolean {
  if (!caller?.emailVerified || typeof caller.email !== 'string') return false;

  const own = caller.email.trim().toLowerCase();
  return own.length > 0 && own === email.trim().toLowerCase();
}

/**
 * True when the caller is an owner or admin of the given team. Any lookup
 * failure is a denial, not an allowance.
 */
export async function isTeamAdmin(
  admin: SupabaseClient | null,
  userId: string | undefined,
  teamId: unknown,
): Promise<boolean> {
  if (!admin || !userId || typeof teamId !== 'string' || !teamId) return false;

  try {
    const { data, error } = await admin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])
      .limit(1);

    return !error && Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error(
      'Team admin lookup failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return false;
  }
}
