#!/usr/bin/env node
/**
 * Weekly receipt API smoke test.
 *
 * Creates a receipt through the public external API, verifies it comes back,
 * then deletes it. This exercises the real product path (auth → validation →
 * subscription check → insert → delete), which the daily keepalive ping does
 * not.
 *
 * Environment:
 *   API_BASE_URL       e.g. https://<ref>.supabase.co/functions/v1/external-api/api/v1
 *   SUPABASE_ANON_KEY  anon key, used for the grant call and as the apikey header
 *   TEST_API_KEY       active mk_test_ API key with receipts:write + receipts:delete
 *   TEST_CI_EMAIL      email of the CI account that owns TEST_API_KEY
 *   TEST_CI_PASSWORD   password of that account (repository Production secret)
 *
 * The external API requires Authorization: Bearer <user session JWT> whose user
 * owns the X-API-Key (api-auth.ts createApiContext enforces bearer user === key
 * user — same pattern the frontend uses). There is no anon-key bypass, so this
 * script mints a token with the password grant before making API calls.
 *
 * Exit 0 on success, 1 on any failure. Response bodies are always printed so a
 * failing Actions run shows the actual API message.
 */

const API_BASE_URL = process.env.API_BASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const API_KEY = process.env.TEST_API_KEY;
const CI_EMAIL = process.env.TEST_CI_EMAIL;
const CI_PASSWORD = process.env.TEST_CI_PASSWORD;

/** Stable merchant name so the row is easy to find and clean up by hand. */
const SMOKE_MERCHANT = 'CI Smoke Test';

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function buildHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-API-Key': API_KEY,
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
  };
}

let cachedToken = null;

/**
 * Password grant against the CI account. The external API requires a real user
 * JWT as Bearer whose user owns the X-API-Key (api-auth.ts createApiContext) —
 * there is no anon-key bypass, so CI mints its own token.
 */
async function getAccessToken() {
  if (cachedToken) return cachedToken;

  const grantUrl = `${new URL(API_BASE_URL).origin}/auth/v1/token?grant_type=password`;
  const response = await fetch(grantUrl, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CI_EMAIL, password: CI_PASSWORD }),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok || !body.access_token) {
    fail(
      `Password grant failed (HTTP ${response.status}: ${JSON.stringify(body)}). ` +
        'Check TEST_CI_EMAIL/TEST_CI_PASSWORD match the CI account from migration 20261013120000.'
    );
  }

  cachedToken = body.access_token;
  return cachedToken;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...buildHeaders(await getAccessToken()), ...(options.headers || {}) },
  });

  let body;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return { status: response.status, body };
}

async function main() {
  if (!API_BASE_URL || !ANON_KEY || !API_KEY || !CI_EMAIL || !CI_PASSWORD) {
    fail(
      'Missing configuration. API_BASE_URL, SUPABASE_ANON_KEY, TEST_API_KEY, ' +
        'TEST_CI_EMAIL and TEST_CI_PASSWORD must all be set.'
    );
  }

  // 1. Unauthenticated health check — proves the function is deployed and
  //    routing before we spend a key on it.
  console.log(`→ GET ${API_BASE_URL}/health`);
  const health = await request('/health');
  console.log(`  HTTP ${health.status} ${JSON.stringify(health.body)}`);
  if (health.status !== 200) {
    fail('Health endpoint did not return 200 — the external-api function may not be deployed.');
  }

  // 2. Create a receipt. Kept minimal: the API requires merchant, date, total.
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    merchant: SMOKE_MERCHANT,
    date: today,
    total: 0.01,
    currency: 'USD',
    status: 'unreviewed',
  };

  console.log(`\n→ POST /receipts ${JSON.stringify(payload)}`);
  const created = await request('/receipts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  console.log(`  HTTP ${created.status} ${JSON.stringify(created.body)}`);

  if (created.status !== 200 && created.status !== 201) {
    fail(
      `Receipt creation returned HTTP ${created.status}. ` +
        `Check that TEST_API_KEY is active and has receipts:write scope, and that the ` +
        `owning account is within its subscription upload limit.`
    );
  }

  const receipt = created.body?.data ?? created.body;
  const receiptId = receipt?.id;
  if (!receiptId) {
    fail(`Receipt was created but the response contained no id: ${JSON.stringify(created.body)}`);
  }
  console.log(`  Created receipt ${receiptId}`);

  // 3. Read it back — proves the insert actually landed, not just that the
  //    API accepted the request.
  console.log(`\n→ GET /receipts/${receiptId}`);
  const read = await request(`/receipts/${receiptId}`);
  console.log(`  HTTP ${read.status} ${JSON.stringify(read.body)}`);
  if (read.status !== 200) {
    // Clean up before failing so a broken read path does not leave litter.
    await cleanup(receiptId);
    fail(`Could not read back the receipt we just created (HTTP ${read.status}).`);
  }

  // 4. Delete it — leaves no trace, and proves receipts:delete works.
  await cleanup(receiptId);

  console.log('\n✅ Receipt API smoke test passed (create → read → delete).');
}

async function cleanup(receiptId) {
  console.log(`\n→ DELETE /receipts/${receiptId}`);
  const deleted = await request(`/receipts/${receiptId}`, { method: 'DELETE' });
  console.log(`  HTTP ${deleted.status} ${JSON.stringify(deleted.body)}`);

  if (deleted.status !== 200 && deleted.status !== 204) {
    console.error(
      `⚠️  Could not delete the smoke receipt ${receiptId}. ` +
        `Remove it manually — merchant is "${SMOKE_MERCHANT}".`
    );
  } else {
    console.log('  Smoke receipt deleted.');
  }
}

main().catch((error) => {
  fail(`Unexpected error: ${error?.stack || error}`);
});
