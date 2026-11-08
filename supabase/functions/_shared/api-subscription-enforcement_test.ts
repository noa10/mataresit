import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import type { ApiContext } from './api-auth.ts';

const { recordUsage } = await import('./api-subscription-enforcement.ts');

type RpcCall = { name: string; params: Record<string, unknown> };

function makeContext(
  result: { data: unknown; error: { message: string } | null } = { data: 13, error: null },
  options: { throws?: boolean } = {},
) {
  const calls: RpcCall[] = [];
  const context = {
    userId: 'user_123',
    supabase: {
      rpc(name: string, params: Record<string, unknown>) {
        calls.push({ name, params });
        if (options.throws) return Promise.reject(new Error('connection reset'));
        return Promise.resolve(result);
      },
    },
  } as unknown as ApiContext;

  return { context, calls };
}

Deno.test('receipt usage increments through the protected counter RPC', async () => {
  const { context, calls } = makeContext();

  await recordUsage(context, 'receipt_upload', 3);

  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, 'increment_receipts_used');
  assertEquals(calls[0].params._user_id, 'user_123');
  assertEquals(calls[0].params._quantity, 3);
});

Deno.test('receipt usage never writes profiles directly', async () => {
  const directWrites: string[] = [];
  const context = {
    userId: 'user_123',
    supabase: {
      from(table: string) {
        directWrites.push(table);
        throw new Error('direct table access must not be used for protected counters');
      },
      rpc() {
        return Promise.resolve({ data: 1, error: null });
      },
    },
  } as unknown as ApiContext;

  await recordUsage(context, 'receipt_upload', 1);

  assertEquals(directWrites, []);
});

Deno.test('a returned database error is contained, not rethrown', async () => {
  const { context, calls } = makeContext({
    data: null,
    error: { message: 'No profile matched user user_123' },
  });

  // Usage tracking is deliberately best-effort; the original contract logs and
  // keeps serving the API request.
  await recordUsage(context, 'receipt_upload', 1);

  assertEquals(calls.length, 1);
});

Deno.test('a thrown RPC failure is contained, not rethrown', async () => {
  const { context } = makeContext({ data: null, error: null }, { throws: true });

  await recordUsage(context, 'receipt_upload', 1);
});

Deno.test('api requests are not counted through the receipt counter', async () => {
  const { context, calls } = makeContext();

  await recordUsage(context, 'api_request', 1);

  assertEquals(calls, []);
});
