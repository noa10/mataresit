import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createWebhookIdempotencyClient, handleWebhookEventSafely, type RpcClient } from './webhook-idempotency.ts';

/**
 * Contract-mapping tests for the webhook idempotency client.
 *
 * Scope: how the client maps RPC outcomes into claim results and fails closed.
 * These do NOT execute claim_stripe_webhook_event / complete_stripe_webhook_event,
 * so they do not prove the SQL guarantees (single active claim, token fencing).
 * Those need a SQL-level test against a nonproduction database; see
 * supabase/tests/ for the existing pgTAP pattern.
 */

type RpcResult = { data: unknown; error: { message: string } | null };

function makeSupabase(handlers: {
  onClaim?: (p: Record<string, unknown>) => RpcResult;
  onComplete?: (p: Record<string, unknown>) => RpcResult;
}): { client: RpcClient; calls: Array<{ name: string; params: Record<string, unknown> }> } {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];

  const client: RpcClient = {
    rpc: (name: string, params: Record<string, unknown>): PromiseLike<RpcResult> => {
      calls.push({ name, params });
      if (name === 'claim_stripe_webhook_event') {
        return Promise.resolve(
          handlers.onClaim?.(params) ?? { data: null, error: null },
        ) as PromiseLike<RpcResult>;
      }
      if (name === 'complete_stripe_webhook_event') {
        return Promise.resolve(
          handlers.onComplete?.(params) ?? { data: true, error: null },
        ) as PromiseLike<RpcResult>;
      }
      return Promise.resolve({
        data: null,
        error: { message: `unknown rpc ${name}` },
      }) as PromiseLike<RpcResult>;
    },
  };

  return { client, calls };
}

Deno.test('handler failure is logged and propagated for retry', async () => {
  const handlerError = new Error('handler failed');
  let logged: unknown[] = [];
  let caught: unknown;
  try {
    await handleWebhookEventSafely(
      async () => { throw handlerError; },
      async (success, error) => { logged = [success, error]; },
    );
  } catch (error) {
    caught = error;
  }
  assertEquals(caught, handlerError);
  assertEquals(logged, [false, handlerError]);
});

Deno.test('handler failure remains the error even when failure logging also fails', async () => {
  const handlerError = new Error('handler failed');
  let caught: unknown;
  try {
    await handleWebhookEventSafely(
      async () => { throw handlerError; },
      async () => { throw new Error('logging failed'); },
    );
  } catch (error) {
    caught = error;
  }
  assertEquals(caught, handlerError);
});

Deno.test('successful handler stays successful if logging fails', async () => {
  await handleWebhookEventSafely(
    async () => {},
    async () => { throw new Error('logging failed'); },
  );
});

Deno.test('first delivery claims the event and receives a fencing token', async () => {
  const { client, calls } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'claimed', token: 'tok-1' }], error: null }),
    onComplete: () => ({ data: true, error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);
  const claim = await idem.claim('evt_1', 'invoice.payment_succeeded');

  assertEquals(claim, { outcome: 'claimed', token: 'tok-1' });
  assertEquals(calls[0].params._event_id, 'evt_1');
  assertEquals(calls[0].params._event_type, 'invoice.payment_succeeded');
});

Deno.test('owner can complete a claim it owns', async () => {
  const { client, calls } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'claimed', token: 'tok-1' }], error: null }),
    onComplete: () => ({ data: true, error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);
  const claim = await idem.claim('evt_1', 'invoice.payment_succeeded');
  if (claim.outcome !== 'claimed') throw new Error('expected a claim');

  assertEquals(await idem.complete('evt_1', claim.token, 'processed'), true);

  const completeCall = calls.find((c) => c.name === 'complete_stripe_webhook_event');
  assertEquals(completeCall?.params._claim_token, 'tok-1');
  assertEquals(completeCall?.params._status, 'processed');
});

Deno.test('already processed event is reported as duplicate with no token', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'duplicate', token: null }], error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);
  assertEquals(await idem.claim('evt_1', 'invoice.payment_succeeded'), { outcome: 'duplicate' });
});

Deno.test('concurrent delivery sees in_flight rather than a second claim', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'in_flight', token: null }], error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);
  assertEquals(await idem.claim('evt_1', 'invoice.payment_succeeded'), { outcome: 'in_flight' });
});

Deno.test('legacy exhausted outcome fails closed so Stripe can retry', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'exhausted', token: null }], error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);
  let threw = false;
  try {
    await idem.claim('evt_1', 'invoice.payment_succeeded');
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test('stale token reports completion failure without hiding the token', async () => {
  const { client, calls } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'claimed', token: 'tok-2' }], error: null }),
    onComplete: () => ({ data: false, error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);
  await idem.claim('evt_1', 'invoice.payment_succeeded');

  // A false result means another delivery superseded this one.
  assertEquals(await idem.complete('evt_1', 'stale-token', 'processed'), false);

  const completeCall = calls.find((c) => c.name === 'complete_stripe_webhook_event');
  assertEquals(completeCall?.params._claim_token, 'stale-token');
});

Deno.test('claim store failure fails closed instead of processing anyway', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: null, error: { message: 'connection error' } }),
  });

  const idem = createWebhookIdempotencyClient(client);

  let message = '';
  try {
    await idem.claim('evt_1', 'invoice.payment_succeeded');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message.includes('connection error'), true);
});

Deno.test('claimed outcome without a token fails closed', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'claimed', token: null }], error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);

  let threw = false;
  try {
    await idem.claim('evt_1', 'invoice.payment_succeeded');
  } catch {
    threw = true;
  }

  assertEquals(threw, true);
});

Deno.test('unrecognised claim outcome fails closed instead of retrying forever', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'wat', token: null }], error: null }),
  });

  const idem = createWebhookIdempotencyClient(client);

  let threw = false;
  try {
    await idem.claim('evt_1', 'invoice.payment_succeeded');
  } catch {
    threw = true;
  }

  assertEquals(threw, true);
});

Deno.test('completion RPC error surfaces instead of reporting success', async () => {
  const { client } = makeSupabase({
    onClaim: () => ({ data: [{ outcome: 'claimed', token: 'tok-3' }], error: null }),
    onComplete: () => ({ data: false, error: { message: 'write failed' } }),
  });

  const idem = createWebhookIdempotencyClient(client);
  const claim = await idem.claim('evt_1', 'invoice.payment_succeeded');
  if (claim.outcome !== 'claimed') throw new Error('expected a claim');

  let threw = false;
  try {
    await idem.complete('evt_1', claim.token, 'processed');
  } catch {
    threw = true;
  }

  assertEquals(threw, true);
});
