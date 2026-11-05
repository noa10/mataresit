import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

const {
  acquireCheckoutOwnership,
  bindCheckoutSession,
  releaseCheckoutLock,
} = await import('./checkout-locks.ts');

type RpcCall = { name: string; params: Record<string, unknown> };
type RpcResult = { data: unknown; error: { message: string } | null };

function makeClient(responses: RpcResult[]) {
  const calls: RpcCall[] = [];
  let index = 0;

  return {
    calls,
    rpc(name: string, params: Record<string, unknown>) {
      calls.push({ name, params });
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return Promise.resolve(response);
    },
  };
}

const lockedRow = (sessionId: string | null): RpcResult => ({
  data: [{ acquired: false, session_id: sessionId, lock_token: null }],
  error: null,
});

const acquiredRow = (token: string): RpcResult => ({
  data: [{ acquired: true, session_id: null, lock_token: token }],
  error: null,
});

Deno.test('acquires the checkout lock for a user with no checkout in flight', async () => {
  const admin = makeClient([acquiredRow('tok-1')]);

  const ownership = await acquireCheckoutOwnership(
    admin,
    'user_123',
    () => Promise.resolve({ status: 'open', url: 'https://checkout.example/session' }),
  );

  assertEquals(ownership, { kind: 'acquired', lockToken: 'tok-1' });
  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].name, 'try_acquire_checkout_lock');
  assertEquals(admin.calls[0].params._user_id, 'user_123');
  assertEquals(admin.calls[0].params._ttl_seconds, 900);
});

Deno.test('passes the configured lock TTL to the acquire RPC', async () => {
  const admin = makeClient([acquiredRow('tok-1')]);

  await acquireCheckoutOwnership(
    admin,
    'user_123',
    () => Promise.resolve({ status: 'open', url: 'https://checkout.example/session' }),
    { ttlSeconds: 2160 },
  );

  assertEquals(admin.calls[0].params._ttl_seconds, 2160);
});

Deno.test('reuses an open Checkout Session instead of creating a second one', async () => {
  const admin = makeClient([lockedRow('cs_test_open')]);
  const inspected: string[] = [];

  const ownership = await acquireCheckoutOwnership(admin, 'user_123', (sessionId) => {
    inspected.push(sessionId);
    return Promise.resolve({ status: 'open', url: 'https://checkout.example/open' });
  });

  assertEquals(ownership, {
    kind: 'reuse',
    sessionId: 'cs_test_open',
    url: 'https://checkout.example/open',
  });
  assertEquals(inspected, ['cs_test_open']);
  assertEquals(admin.calls.length, 1, 'reuse must not release or retry');
});

Deno.test('reports busy while another request is preparing its session', async () => {
  const admin = makeClient([lockedRow(null)]);

  const ownership = await acquireCheckoutOwnership(admin, 'user_123', () => {
    throw new Error('must not inspect a session that is not bound yet');
  });

  assertEquals(ownership, { kind: 'busy' });
});

Deno.test('reports busy when the bound session is already completed', async () => {
  const admin = makeClient([lockedRow('cs_test_complete')]);

  const ownership = await acquireCheckoutOwnership(
    admin,
    'user_123',
    () => Promise.resolve({ status: 'complete' }),
  );

  assertEquals(ownership, { kind: 'busy' });
  assertEquals(admin.calls.length, 1, 'a completed session must not be released or retried');
});

Deno.test('reports busy when the session state cannot be inspected', async () => {
  const admin = makeClient([lockedRow('cs_test_unknown')]);

  const ownership = await acquireCheckoutOwnership(
    admin,
    'user_123',
    () => Promise.resolve({ status: 'unknown' }),
  );

  assertEquals(ownership, { kind: 'busy' });
});

Deno.test('steals the lock once the bound session has expired', async () => {
  const admin = makeClient([
    lockedRow('cs_test_expired'),
    { data: true, error: null },
    acquiredRow('tok-2'),
  ]);

  const ownership = await acquireCheckoutOwnership(
    admin,
    'user_123',
    () => Promise.resolve({ status: 'expired' }),
  );

  assertEquals(ownership, { kind: 'acquired', lockToken: 'tok-2' });
  assertEquals(admin.calls.map((call) => call.name), [
    'try_acquire_checkout_lock',
    'release_checkout_lock',
    'try_acquire_checkout_lock',
  ]);
  assertEquals(admin.calls[1].params._session_id, 'cs_test_expired');
});

Deno.test('does not steal the lock when the expired release fails', async () => {
  const admin = makeClient([
    lockedRow('cs_test_expired'),
    { data: false, error: null },
  ]);

  const ownership = await acquireCheckoutOwnership(
    admin,
    'user_123',
    () => Promise.resolve({ status: 'expired' }),
  );

  assertEquals(ownership, { kind: 'busy' });
  assertEquals(admin.calls.length, 2);
});

Deno.test('fails closed when the lock store is unavailable', async () => {
  const admin = makeClient([{ data: null, error: { message: 'connection reset' } }]);

  await assertRejects(
    () => acquireCheckoutOwnership(admin, 'user_123', () => Promise.resolve({ status: 'expired' as const })),
    Error,
    'Failed to acquire the checkout lock',
  );
});

Deno.test('fails closed on an unexpected lock RPC result shape', async () => {
  const admin = makeClient([{ data: [{ acquired: 'yes' }], error: null }]);

  await assertRejects(
    () => acquireCheckoutOwnership(admin, 'user_123', () => Promise.resolve({ status: 'expired' as const })),
    Error,
    'unexpected result',
  );
});

Deno.test('fails closed when an acquired row carries no lock token', async () => {
  const admin = makeClient([{ data: [{ acquired: true, session_id: null, lock_token: null }], error: null }]);

  await assertRejects(
    () => acquireCheckoutOwnership(admin, 'user_123', () => Promise.resolve({ status: 'expired' as const })),
    Error,
    'no lock token',
  );
});

Deno.test('binds the created session with its own expiry', async () => {
  const admin = makeClient([{ data: true, error: null }]);

  const bound = await bindCheckoutSession(admin, 'user_123', 'tok-1', 'cs_test_123', 1_700_000_000);

  assertEquals(bound, true);
  assertEquals(admin.calls[0].name, 'bind_checkout_session');
  assertEquals(admin.calls[0].params._lock_token, 'tok-1');
  assertEquals(admin.calls[0].params._session_id, 'cs_test_123');
  assertEquals(admin.calls[0].params._expires_at, '2023-11-14T22:13:20.000Z');
});

Deno.test('a failed bind returns false and keeps the session bound to nobody', async () => {
  const admin = makeClient([{ data: false, error: null }]);

  const bound = await bindCheckoutSession(admin, 'user_123', 'tok-1', 'cs_test_123', 1_700_000_000);

  assertEquals(bound, false);
});

Deno.test('release by session id reports the database result', async () => {
  const admin = makeClient([{ data: true, error: null }]);

  const released = await releaseCheckoutLock(admin, 'user_123', { sessionId: 'cs_test_123' });

  assertEquals(released, true);
  assertEquals(admin.calls[0].params._session_id, 'cs_test_123');
  assertEquals(admin.calls[0].params._lock_token, null);
});

Deno.test('release by lock token reports the database result', async () => {
  const admin = makeClient([{ data: true, error: null }]);

  const released = await releaseCheckoutLock(admin, 'user_123', { lockToken: 'tok-1' });

  assertEquals(released, true);
  assertEquals(admin.calls[0].params._lock_token, 'tok-1');
  assertEquals(admin.calls[0].params._session_id, null);
});

Deno.test('release with neither key is refused without an RPC call', async () => {
  const admin = makeClient([]);

  const released = await releaseCheckoutLock(admin, 'user_123', {});

  assertEquals(released, false);
  assertEquals(admin.calls.length, 0);
});

Deno.test('release failures are contained and reported as false', async () => {
  const admin = makeClient([{ data: null, error: { message: 'deadlock detected' } }]);

  const released = await releaseCheckoutLock(admin, 'user_123', { lockToken: 'tok-1' });

  assertEquals(released, false);
});

Deno.test('a throwing release is contained and reported as false', async () => {
  const admin = {
    rpc() {
      return Promise.reject(new Error('network down'));
    },
  };

  const released = await releaseCheckoutLock(admin, 'user_123', { sessionId: 'cs_test_123' });

  assertEquals(released, false);
});
