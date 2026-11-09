import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  callerOwnsEmail,
  extractBearerToken,
  isPrivileged,
  isSelf,
  isTeamAdmin,
  normalizeEmail,
  resolveCaller,
  secureEquals,
  type Caller,
} from './function-auth.ts';

const user: Caller = {
  role: 'user',
  userId: 'user-1',
  email: 'User@Example.com',
  profileEmail: 'billing@example.com',
};

Deno.test('extractBearerToken accepts case-insensitive Bearer tokens', () => {
  assertEquals(extractBearerToken('Bearer abc.def'), 'abc.def');
  assertEquals(extractBearerToken('bearer   abc.def  '), 'abc.def');
});

Deno.test('extractBearerToken rejects missing or malformed headers', () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken(''), null);
  assertEquals(extractBearerToken('Basic abc'), null);
  assertEquals(extractBearerToken('Bearer   '), null);
});

Deno.test('secureEquals matches exact strings only', () => {
  assertEquals(secureEquals('service-key', 'service-key'), true);
  assertEquals(secureEquals('service-key', 'service-kez'), false);
  assertEquals(secureEquals('service-key', 'service-key '), false);
  assertEquals(secureEquals('', ''), true);
});

Deno.test('normalizeEmail accepts one bare address and lowercases it', () => {
  assertEquals(normalizeEmail(' User@Example.com '), 'user@example.com');
});

Deno.test('normalizeEmail rejects lists, aliases, and header injection', () => {
  assertEquals(normalizeEmail('a@example.com,b@example.com'), null);
  assertEquals(normalizeEmail('a@example.com; b@example.com'), null);
  assertEquals(normalizeEmail('Name <user@example.com>'), null);
  assertEquals(normalizeEmail('user@example.com\r\nBcc: victim@example.com'), null);
  assertEquals(normalizeEmail('not-an-email'), null);
  assertEquals(normalizeEmail(undefined), null);
});

Deno.test('isSelf compares the authenticated user id', () => {
  assertEquals(isSelf(user, 'user-1'), true);
  assertEquals(isSelf(user, 'user-2'), false);
  assertEquals(isSelf(user, undefined), false);
  assertEquals(isSelf(null, 'user-1'), false);
});

Deno.test('callerOwnsEmail checks both auth and profile addresses', () => {
  assertEquals(callerOwnsEmail(user, 'user@example.com'), true);
  assertEquals(callerOwnsEmail(user, 'billing@example.com'), true);
  assertEquals(callerOwnsEmail(user, 'other@example.com'), false);
  assertEquals(callerOwnsEmail(null, 'user@example.com'), false);
});

Deno.test('isPrivileged allows only service role and global admins', () => {
  assertEquals(isPrivileged({ role: 'service_role' }), true);
  assertEquals(isPrivileged({ role: 'admin', userId: 'admin-1' }), true);
  assertEquals(isPrivileged(user), false);
  assertEquals(isPrivileged(null), false);
});

interface FakeAdminOptions {
  user?: { id: string; email?: string } | null;
  userError?: unknown;
  roles?: string[];
  profileEmail?: string | null;
  teamRole?: string | null;
  teamError?: unknown;
}

/**
 * Minimal chainable stand-in for SupabaseClient. It emulates the two filters
 * the authorization helpers rely on: admin-role lookup and team-role lookup.
 */
function fakeAdmin(options: FakeAdminOptions): SupabaseClient {
  const resultFor = (table: string) => {
    if (table === 'user_roles') {
      return { data: (options.roles ?? []).map((role) => ({ role })), error: null };
    }
    if (table === 'profiles') {
      return {
        data: options.profileEmail === undefined ? null : { email: options.profileEmail },
        error: null,
      };
    }
    if (table === 'team_members') {
      const isTeamAdminRole = options.teamRole === 'owner' || options.teamRole === 'admin';
      return {
        data: isTeamAdminRole ? [{ role: options.teamRole }] : [],
        error: options.teamError ?? null,
      };
    }
    return { data: null, error: null };
  };

  const from = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      limit: () => builder,
      maybeSingle: async () => resultFor(table),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resultFor(table)).then(resolve),
    };
    return builder;
  };

  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: options.userError ?? null,
      }),
    },
    from,
  } as unknown as SupabaseClient;
}

async function withServiceKey(fn: () => Promise<void>): Promise<void> {
  const previousBuiltIn = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const previousExplicit = Deno.env.get('SERVICE_ROLE_KEY');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  Deno.env.delete('SERVICE_ROLE_KEY');

  try {
    await fn();
  } finally {
    if (previousBuiltIn === undefined) {
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    } else {
      Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousBuiltIn);
    }
    if (previousExplicit === undefined) {
      Deno.env.delete('SERVICE_ROLE_KEY');
    } else {
      Deno.env.set('SERVICE_ROLE_KEY', previousExplicit);
    }
  }
}

Deno.test('resolveCaller accepts the exact service-role key', async () => {
  await withServiceKey(async () => {
    const caller = await resolveCaller(
      new Request('http://localhost', {
        headers: { Authorization: 'Bearer service-key' },
      }),
      null,
    );
    assertEquals(caller, { role: 'service_role' });
  });
});

Deno.test('resolveCaller classifies a regular user', async () => {
  await withServiceKey(async () => {
    const admin = fakeAdmin({
      user: { id: 'user-1', email: 'auth@example.com' },
      roles: [],
      profileEmail: 'profile@example.com',
    });
    const caller = await resolveCaller(
      new Request('http://localhost', {
        headers: { Authorization: 'Bearer user-token' },
      }),
      admin,
    );

    assertEquals(caller, {
      role: 'user',
      userId: 'user-1',
      email: 'auth@example.com',
      profileEmail: 'profile@example.com',
    });
  });
});

Deno.test('resolveCaller classifies a global admin', async () => {
  await withServiceKey(async () => {
    const admin = fakeAdmin({
      user: { id: 'admin-1', email: 'admin@example.com' },
      roles: ['admin'],
    });
    const caller = await resolveCaller(
      new Request('http://localhost', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      admin,
    );

    assertEquals(caller, {
      role: 'admin',
      userId: 'admin-1',
      email: 'admin@example.com',
    });
  });
});

Deno.test('resolveCaller rejects invalid user tokens', async () => {
  await withServiceKey(async () => {
    const admin = fakeAdmin({ user: null, userError: new Error('invalid token') });
    const caller = await resolveCaller(
      new Request('http://localhost', {
        headers: { Authorization: 'Bearer bad-token' },
      }),
      admin,
    );

    assertEquals(caller, null);
  });
});

Deno.test('isTeamAdmin accepts owners and admins only', async () => {
  assertEquals(await isTeamAdmin(fakeAdmin({ teamRole: 'owner' }), 'user-1', 'team-1'), true);
  assertEquals(await isTeamAdmin(fakeAdmin({ teamRole: 'admin' }), 'user-1', 'team-1'), true);
  assertEquals(await isTeamAdmin(fakeAdmin({ teamRole: 'member' }), 'user-1', 'team-1'), false);
});

Deno.test('isTeamAdmin denies missing inputs and lookup failures', async () => {
  assertEquals(await isTeamAdmin(null, 'user-1', 'team-1'), false);
  assertEquals(await isTeamAdmin(fakeAdmin({ teamRole: 'owner' }), undefined, 'team-1'), false);
  assertEquals(await isTeamAdmin(fakeAdmin({ teamRole: 'owner' }), 'user-1', null), false);
  assertEquals(
    await isTeamAdmin(fakeAdmin({ teamError: new Error('lookup failed') }), 'user-1', 'team-1'),
    false,
  );
});
