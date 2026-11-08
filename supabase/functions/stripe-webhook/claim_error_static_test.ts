const webhookUrl = new URL('./index.ts', import.meta.url);

/**
 * Structural regression guard for the webhook claim path.
 *
 * The runtime behaviour of `claim()` (throwing on RPC failure or a shape
 * mismatch) is covered by `_shared/webhook-idempotency_test.ts`. This test
 * pins the HTTP contract the handler must layer on top: claim errors get a
 * deliberate 5xx before any event processing, without attempting completion
 * (a failed claim has no fencing token).
 */
Deno.test('claim acquisition failure returns an explicit retryable 500', async () => {
  const webhook = await Deno.readTextFile(webhookUrl);

  const claimCall = webhook.indexOf('webhookIdempotency.claim(event.id, event.type)');
  if (claimCall < 0) {
    throw new Error('Expected the webhook to claim the event');
  }

  const claimTry = webhook.lastIndexOf('try {', claimCall);
  const claimCatch = webhook.indexOf('} catch (error) {', claimCall);
  const duplicateBranch = webhook.indexOf('claim.outcome', claimCall);

  if (claimTry < 0 || claimCatch < 0 || duplicateBranch < 0 || claimCatch > duplicateBranch) {
    throw new Error(
      'Claim acquisition must be wrapped in a dedicated try/catch before the outcome branches',
    );
  }

  const tryBody = webhook.slice(claimTry, claimCatch);
  if (tryBody.includes('} catch')) {
    throw new Error('Claim acquisition must not share the handler-level try block');
  }

  const catchBody = webhook.slice(claimCatch, duplicateBranch);
  const claimFailureResponse =
    /return\s+jsonResponse\(\s*\{\s*error:\s*['"]Webhook claim failed['"]\s*\}\s*,\s*500\s*\)/;
  if (!claimFailureResponse.test(catchBody)) {
    throw new Error('Claim failures must return an explicit 500 so Stripe retries');
  }
  if (catchBody.includes('webhookIdempotency.complete')) {
    throw new Error('A failed claim has no token, so completion must not be attempted');
  }
});

/**
 * The handler's catch block must still return a deliberate 500 when the
 * completion store is down. An unguarded `complete(..., 'failed')` would throw
 * out of the handler, replacing the structured retry signal with an
 * unstructured platform error.
 */
Deno.test('failure completion is guarded so the retryable 500 survives an outage', async () => {
  const webhook = await Deno.readTextFile(webhookUrl);

  const guardedCompletion =
    /try\s*\{\s*await webhookIdempotency\.complete\(\s*event\.id,\s*claim\.token,\s*'failed',\s*message,?\s*\);\s*\}\s*catch\s*\(completionError\)/;
  if (!guardedCompletion.test(webhook)) {
    throw new Error('Failure completion must be wrapped in try/catch');
  }

  const failureResponse = webhook.indexOf("'Webhook processing failed'");
  const guardedCatch = webhook.search(/catch\s*\(completionError\)/);
  if (failureResponse < 0 || guardedCatch < 0 || failureResponse < guardedCatch) {
    throw new Error('The retryable 500 must be returned after the guarded completion');
  }
});
