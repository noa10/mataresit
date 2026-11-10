import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getServiceRoleKey } from './service-role.ts';

const ENV_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY'] as const;

/** Deno.env is process-wide: restore it so these tests cannot leak state. */
function withIsolatedEnv(fn: () => void): void {
  const before = new Map(ENV_KEYS.map((key) => [key, Deno.env.get(key)]));
  try {
    fn();
  } finally {
    for (const [key, value] of before) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

Deno.test('returns the injected service-role key, trimmed', () =>
  withIsolatedEnv(() => {
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', ' built-in-key ');

    assertEquals(getServiceRoleKey(), 'built-in-key');
  }));

Deno.test('ignores the retired SERVICE_ROLE_KEY secret', () =>
  withIsolatedEnv(() => {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    Deno.env.set('SERVICE_ROLE_KEY', 'stale-explicit-key');

    assertEquals(getServiceRoleKey(), undefined);
  }));

Deno.test('returns undefined when no service-role key is configured', () =>
  withIsolatedEnv(() => {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    Deno.env.delete('SERVICE_ROLE_KEY');

    assertEquals(getServiceRoleKey(), undefined);
  }));
