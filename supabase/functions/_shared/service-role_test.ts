import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getServiceRoleKey } from './service-role.ts';

Deno.test('prefers the injected service-role key', () => {
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', ' built-in-key ');
  Deno.env.set('SERVICE_ROLE_KEY', 'stale-explicit-key');

  assertEquals(getServiceRoleKey(), 'built-in-key');
});

Deno.test('falls back to the explicit service-role key', () => {
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  Deno.env.set('SERVICE_ROLE_KEY', ' explicit-key ');

  assertEquals(getServiceRoleKey(), 'explicit-key');
});

Deno.test('returns undefined when no service-role key is configured', () => {
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  Deno.env.delete('SERVICE_ROLE_KEY');

  assertEquals(getServiceRoleKey(), undefined);
});
