/**
 * Webhook idempotency client contract.
 *
 * The correctness guarantee lives in the SQL RPCs: claim_stripe_webhook_event
 * is a single atomic INSERT ... ON CONFLICT, so at most one caller can hold an
 * active lease for an event. complete_stripe_webhook_event is fenced by the
 * per-claim token, so a slow or crashed worker cannot mark a newer claim.
 *
 * Guarantee: at most one ACTIVE claim per event. This is NOT exactly-once for
 * external side effects (emails, audit rows, renewal RPCs) - those remain
 * at-least-once and must stay independently idempotent.
 */

export async function handleWebhookEventSafely(
  handler: () => Promise<void>,
  log: (success: boolean, error?: unknown) => Promise<void>,
): Promise<void> {
  try {
    await handler();
  } catch (error) {
    try {
      await log(false, error);
    } catch {
      // Logging must not mask the handler failure.
    }
    throw error;
  }

  try {
    await log(true);
  } catch {
    // Logging is best effort and must not retry successful work.
  }
}

export type WebhookClaim =
  | { outcome: 'claimed'; token: string }
  | { outcome: 'duplicate' }
  | { outcome: 'in_flight' };

const CLAIM_OUTCOMES = ['claimed', 'duplicate', 'in_flight'] as const;

function isClaimOutcome(value: unknown): value is (typeof CLAIM_OUTCOMES)[number] {
  return typeof value === 'string'
    && (CLAIM_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Minimal surface actually used: supabase-js `rpc()`. It returns a thenable
 * PostgrestFilterBuilder rather than a Promise, so this must stay PromiseLike.
 */
export interface RpcClient {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

const LEASE_SECONDS = 300;

function firstRow(data: unknown): { outcome: string; token: string | null } | null {
  if (Array.isArray(data)) return (data[0] ?? null) as never;
  return (data ?? null) as never;
}

export function createWebhookIdempotencyClient(client: RpcClient) {
  return {
    async claim(eventId: string, eventType: string): Promise<WebhookClaim> {
      const { data, error } = await client.rpc('claim_stripe_webhook_event', {
        _event_id: eventId,
        _event_type: eventType,
        _lease_seconds: LEASE_SECONDS,
      });

      // Fail closed: never process when the idempotency store is unavailable.
      if (error) {
        throw new Error(`Webhook claim failed for ${eventId}: ${error.message}`);
      }

      const row = firstRow(data);
      const outcome = row?.outcome;

      // An unexpected shape means the SQL contract drifted. Fail closed so
      // Stripe can retry rather than acknowledging unprocessed work.
      if (!isClaimOutcome(outcome)) {
        throw new Error(
          `Unexpected webhook claim outcome for ${eventId}: ${String(outcome)}`,
        );
      }

      if (outcome === 'claimed') {
        if (!row?.token) {
          throw new Error(`Webhook claim for ${eventId} returned no token`);
        }
        return { outcome: 'claimed', token: String(row.token) };
      }

      if (outcome === 'duplicate') return { outcome: 'duplicate' };
      return { outcome: 'in_flight' };
    },

    /**
     * Returns true only when this caller owned the active claim. A false result
     * means another delivery superseded this one; the caller must not report
     * completion.
     */
    async complete(
      eventId: string,
      token: string,
      status: 'processed' | 'failed',
      lastError?: string,
    ): Promise<boolean> {
      const { data, error } = await client.rpc('complete_stripe_webhook_event', {
        _event_id: eventId,
        _claim_token: token,
        _status: status,
        _last_error: lastError ?? null,
      });

      if (error) {
        throw new Error(`Webhook completion failed for ${eventId}: ${error.message}`);
      }

      return data === true;
    },
  };
}
