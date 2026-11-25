import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { deriveDisplayName } from './profile-name.ts';

Deno.test('deriveDisplayName joins both names', () => {
  assertEquals(
    deriveDisplayName({ first_name: 'Aisyah', last_name: 'Rahman', email: 'aisyah@example.com' }),
    'Aisyah Rahman',
  );
});

Deno.test('deriveDisplayName uses whichever single name is present', () => {
  assertEquals(deriveDisplayName({ first_name: 'Aisyah', last_name: null, email: 'a@example.com' }), 'Aisyah');
  assertEquals(deriveDisplayName({ first_name: null, last_name: 'Rahman', email: 'a@example.com' }), 'Rahman');
  assertEquals(deriveDisplayName({ first_name: 'Aisyah', email: 'a@example.com' }), 'Aisyah');
});

Deno.test('deriveDisplayName falls back to email when names are whitespace-only', () => {
  assertEquals(
    deriveDisplayName({ first_name: '   ', last_name: '  ', email: 'a@example.com' }),
    'a@example.com',
  );
  assertEquals(deriveDisplayName({ first_name: '', last_name: '', email: 'a@example.com' }), 'a@example.com');
});

Deno.test('deriveDisplayName falls back to email when neither name exists', () => {
  assertEquals(deriveDisplayName({ first_name: null, last_name: null, email: 'a@example.com' }), 'a@example.com');
  assertEquals(deriveDisplayName({ email: 'a@example.com' }), 'a@example.com');
  // COALESCE only replaces NULL, so an empty email stays empty.
  assertEquals(deriveDisplayName({ email: '' }), '');
});

Deno.test('deriveDisplayName trims surrounding whitespace and tolerates a missing profile', () => {
  // Same as TRIM(CONCAT_WS(' ', first_name, last_name)): only outer spaces go away.
  assertEquals(deriveDisplayName({ first_name: '  Aisyah ', last_name: ' Rahman  ' }), 'Aisyah   Rahman');
  assertEquals(deriveDisplayName(null), null);
  assertEquals(deriveDisplayName(undefined), null);
  assertEquals(deriveDisplayName({}), null);
});

// ---------------------------------------------------------------------------
// Static regression guards: hosted public.profiles has first_name/last_name,
// never full_name, so any select of profiles.full_name breaks the whole query.
// ---------------------------------------------------------------------------

const functionSources = {
  'billing-auto-renewal': new URL('../billing-auto-renewal/index.ts', import.meta.url),
  'email-scheduler': new URL('../email-scheduler/index.ts', import.meta.url),
  'billing-cron-jobs': new URL('../billing-cron-jobs/index.ts', import.meta.url),
} as const;

Deno.test('billing functions never select full_name from profiles', async () => {
  for (const [name, url] of Object.entries(functionSources)) {
    const source = await Deno.readTextFile(url);

    if (source.includes('full_name')) {
      throw new Error(
        `${name} references full_name, but hosted public.profiles has only first_name/last_name`,
      );
    }
  }
});

Deno.test('billing functions select the real profile name columns', async () => {
  const autoRenewal = await Deno.readTextFile(functionSources['billing-auto-renewal']);
  const emailScheduler = await Deno.readTextFile(functionSources['email-scheduler']);

  for (
    const [name, source, expected] of [
      [
        'billing-auto-renewal',
        autoRenewal,
        ".select('email, first_name, last_name')",
      ],
      [
        'email-scheduler',
        emailScheduler,
        ".select('id, email, first_name, last_name, stripe_subscription_id')",
      ],
    ] as const
  ) {
    if (!source.includes(expected)) {
      throw new Error(`${name} must select ${expected}`);
    }

    if (!source.includes("from '../_shared/profile-name.ts'")) {
      throw new Error(`${name} must import deriveDisplayName from the shared helper`);
    }

    if (!source.includes('deriveDisplayName(profile)')) {
      throw new Error(`${name} must derive recipientName with deriveDisplayName(profile)`);
    }
  }
});
