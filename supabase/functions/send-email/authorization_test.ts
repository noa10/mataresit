import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { resolveCaller } from '../_shared/function-auth.ts';
import { authorizeUserEmail } from './authorization.ts';

interface FakeAdminOptions {
  user?: { id: string; email?: string; email_confirmed_at?: string | null } | null;
  profilesEmail?: string | null;
}

/**
 * Minimal stand-in for the service-role client. `profiles` deliberately returns
 * a caller-writable row so the regression test can prove it is ignored.
 */
function fakeAdmin(options: FakeAdminOptions): SupabaseClient {
  const resultFor = (table: string) => {
    if (table === 'user_roles') return { data: [], error: null };
    if (table === 'profiles') {
      return {
        data: options.profilesEmail === undefined ? null : { email: options.profilesEmail },
        error: null,
      };
    }
    if (table === 'team_members') return { data: [], error: null };
    return { data: null, error: null };
  };

  const from = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      limit: () => builder,
      gte: () => builder,
      maybeSingle: async () => resultFor(table),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resultFor(table)).then(resolve),
    };
    return builder;
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null }, error: null }),
    },
    from,
  } as unknown as SupabaseClient;
}

async function withServiceKey(fn: () => Promise<void>): Promise<void> {
  const previous = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

  try {
    await fn();
  } finally {
    if (previous === undefined) {
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    } else {
      Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previous);
    }
  }
}

function userRequest(): Request {
  return new Request('http://localhost', {
    headers: { Authorization: 'Bearer user-token' },
  });
}

Deno.test('send-email denies a non-preview send after profiles.email is changed to the victim', async () => {
  await withServiceKey(async () => {
    const admin = fakeAdmin({
      user: {
        id: 'attacker',
        email: 'attacker@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
      profilesEmail: 'victim@example.com',
    });
    const caller = await resolveCaller(userRequest(), admin);
    assertEquals(caller?.email, 'attacker@example.com');

    const authorization = await authorizeUserEmail(
      caller!,
      {
        to: 'victim@example.com',
        subject: 'Invoice',
        html: '<p>Pay here</p>',
        template_name: 'receipt_processing',
        template_data: {},
      },
      admin,
    );

    assertEquals(authorization.allowed, false);
  });
});

Deno.test('send-email allows a non-preview send to the caller verified auth address', async () => {
  await withServiceKey(async () => {
    const admin = fakeAdmin({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    });
    const caller = await resolveCaller(userRequest(), admin);

    const authorization = await authorizeUserEmail(
      caller!,
      { to: 'user@example.com', subject: 'Hello', html: '<p>Hello</p>' },
      admin,
    );

    assertEquals(authorization.allowed, true);
  });
});

Deno.test('send-email denies a non-preview send from an unconfirmed auth address', async () => {
  await withServiceKey(async () => {
    const admin = fakeAdmin({
      user: { id: 'user-1', email: 'user@example.com', email_confirmed_at: null },
    });
    const caller = await resolveCaller(userRequest(), admin);

    const authorization = await authorizeUserEmail(
      caller!,
      { to: 'user@example.com', subject: 'Hello', html: '<p>Hello</p>' },
      admin,
    );

    assertEquals(authorization.allowed, false);
  });
});
