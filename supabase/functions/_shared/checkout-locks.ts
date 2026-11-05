/**
 * Durable per-user Checkout ownership.
 *
 * Stripe has no "create customer if absent" primitive, and two concurrent
 * create-checkout-session requests for the same user could otherwise create two
 * Stripe customers and two completable Checkout Sessions. The
 * stripe_checkout_locks row makes one request the owner at a time, and
 * bind_checkout_session ties the lock's lifetime to the Checkout Session's own
 * expiry, so a second request reuses the open session instead of creating one.
 *
 * Each acquisition returns a lock token. Only that token can bind the session
 * or release the lock on a failure path, so a stale request cannot bind or free
 * a lock that now belongs to a newer request. The completion webhook releases
 * by session id instead, which only matches the row bound to that exact
 * session.
 *
 * The lock is not a substitute for Stripe state checks: create-checkout-session
 * still asks Stripe whether the customer already has a subscription, and reuse
 * only happens while the bound session is open and for the same plan.
 */

export interface CheckoutLockRpcClient {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type CheckoutSessionInspection =
  | { status: 'open'; url: string }
  | { status: 'complete' }
  | { status: 'expired' }
  | { status: 'unknown' };

export type CheckoutSessionInspector = (
  sessionId: string,
) => Promise<CheckoutSessionInspection>;

export type CheckoutOwnership =
  | { kind: 'acquired'; lockToken: string }
  | { kind: 'reuse'; sessionId: string; url: string }
  | { kind: 'busy' };

interface LockRow {
  acquired: boolean;
  sessionId: string | null;
  lockToken: string | null;
}

function readLockRow(data: unknown): LockRow | null {
  // PostgREST returns a RETURNS TABLE result as an array of rows; tolerate a
  // bare object so a PostgREST shape change cannot look like an acquisition.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const record = row as Record<string, unknown>;
  if (typeof record.acquired !== 'boolean') return null;

  const sessionId = record.session_id;
  const lockToken = record.lock_token;
  return {
    acquired: record.acquired,
    sessionId: typeof sessionId === 'string' ? sessionId : null,
    lockToken: typeof lockToken === 'string' ? lockToken : null,
  };
}

/**
 * Take ownership of the user's checkout, or reuse the session a previous
 * request left open. Throws when the lock store itself is unavailable: a
 * checkout without ownership would recreate the duplicate-session race.
 */
export async function acquireCheckoutOwnership(
  supabaseAdmin: CheckoutLockRpcClient,
  userId: string,
  inspectSession: CheckoutSessionInspector,
  options?: { ttlSeconds?: number },
): Promise<CheckoutOwnership> {
  // Two attempts: the first may find an expired session to steal.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabaseAdmin.rpc('try_acquire_checkout_lock', {
      _user_id: userId,
      _ttl_seconds: options?.ttlSeconds ?? 900,
    });

    if (error) {
      throw new Error(`Failed to acquire the checkout lock: ${error.message}`);
    }

    const row = readLockRow(data);
    if (!row) {
      throw new Error('Checkout lock RPC returned an unexpected result');
    }

    if (row.acquired) {
      // A claimed row always carries a token; refuse to proceed without one.
      if (!row.lockToken) {
        throw new Error('Checkout lock RPC returned no lock token');
      }
      return { kind: 'acquired', lockToken: row.lockToken };
    }

    // A live lock with no session bound: another request is still preparing
    // its session, so creating ours now would produce a second session.
    if (!row.sessionId) return { kind: 'busy' };

    const inspection = await inspectSession(row.sessionId);

    if (inspection.status === 'open') {
      return { kind: 'reuse', sessionId: row.sessionId, url: inspection.url };
    }

    // The session completed but its webhook has not released the lock yet.
    // Creating another session here could sell a second subscription; report
    // busy and let the webhook finish.
    if (inspection.status === 'complete' || inspection.status === 'unknown') {
      return { kind: 'busy' };
    }

    // Expired, missing, or replaced at Stripe: the session is no longer
    // completable, so stealing the lock cannot produce two live sessions.
    const released = await releaseCheckoutLock(supabaseAdmin, userId, {
      sessionId: row.sessionId,
    });
    if (!released) return { kind: 'busy' };
  }

  return { kind: 'busy' };
}

/**
 * Bind a created Checkout Session to the lock so the lock lives exactly as long
 * as the session is completable. Only the owning request's token can bind.
 */
export async function bindCheckoutSession(
  supabaseAdmin: CheckoutLockRpcClient,
  userId: string,
  lockToken: string,
  sessionId: string,
  sessionExpiresAt: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('bind_checkout_session', {
    _user_id: userId,
    _lock_token: lockToken,
    _session_id: sessionId,
    _expires_at: new Date(sessionExpiresAt * 1000).toISOString(),
  });

  if (error) {
    console.error(`Failed to bind Checkout Session ${sessionId} to the checkout lock:`, error.message);
    return false;
  }

  return data === true;
}

/**
 * Release a lock. Best-effort: a release failure only delays the next checkout
 * until the lock's own expiry, and reporting it must not turn an otherwise
 * successful response into a 500.
 *
 * Exactly one of `lockToken` (owner release) or `sessionId` (completion
 * release) is used. The database matches the row by that key only, so a stale
 * request or a delayed webhook cannot free a newer checkout's lock.
 */
export async function releaseCheckoutLock(
  supabaseAdmin: CheckoutLockRpcClient,
  userId: string,
  release: { sessionId?: string; lockToken?: string },
): Promise<boolean> {
  if (!release.sessionId && !release.lockToken) return false;

  try {
    const { data, error } = await supabaseAdmin.rpc('release_checkout_lock', {
      _user_id: userId,
      _session_id: release.sessionId ?? null,
      _lock_token: release.lockToken ?? null,
    });

    if (error) {
      console.error(`Failed to release the checkout lock for user ${userId}:`, error.message);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`Failed to release the checkout lock for user ${userId}:`, error);
    return false;
  }
}
