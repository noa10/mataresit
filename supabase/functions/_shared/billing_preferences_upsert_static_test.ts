const emailSchedulerUrl = new URL('../email-scheduler/index.ts', import.meta.url);
const billingAutoRenewalUrl = new URL('../billing-auto-renewal/index.ts', import.meta.url);

// billing_preferences has a generated id primary key and a separate unique
// constraint on user_id. The upsert payloads carry user_id but no id, so
// without an explicit conflict target PostgREST targets the id primary key,
// takes the insert path, and raises 23505 on the user_id unique constraint.
const conflictTargetPattern =
  /\.from\('billing_preferences'\)\s*\.upsert\(\{([\s\S]*?)\},\s*\{\s*onConflict:\s*'user_id'\s*\}\s*\)/;

async function assertUpsertsOnUserId(url: URL, label: string) {
  const source = await Deno.readTextFile(url);
  const match = source.match(conflictTargetPattern);

  if (!match) {
    throw new Error(
      `${label} must upsert into billing_preferences with { onConflict: 'user_id' }`,
    );
  }

  if (!match[1].includes('user_id:')) {
    throw new Error(`${label} billing_preferences upsert must include user_id in the payload`);
  }

  if (/\bid\s*:/.test(match[1])) {
    throw new Error(
      `${label} billing_preferences upsert must not send an id: user_id is the intended conflict target`,
    );
  }
}

Deno.test('email-scheduler upserts billing_preferences on the user_id conflict target', async () => {
  await assertUpsertsOnUserId(
    emailSchedulerUrl,
    'email-scheduler updateEmailPreferences',
  );
});

Deno.test('billing-auto-renewal upserts billing_preferences on the user_id conflict target', async () => {
  await assertUpsertsOnUserId(
    billingAutoRenewalUrl,
    'billing-auto-renewal updateAutoRenewalSettings',
  );
});
