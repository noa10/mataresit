import { assertEquals } from 'jsr:@std/assert';

import { handleQuickReceiptAPI } from './api-receipts-quick.ts';

function createApiContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: '3d5d9f3d-3cf5-4371-a998-a7e9f8c1f001',
    teamId: undefined,
    scopes: ['receipts:write'],
    keyId: 'key-123',
    supabase: null,
    userSupabase: null,
    authHeader: 'Bearer test-token',
    ...overrides,
  };
}

function createSupabaseStub(options: {
  canCreate?: { allowed: boolean; reason?: string };
  teamMember?: { role: string } | null;
  matchedCategoryId?: string | null;
  receiptId?: string;
}) {
  const calls = {
    rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
    receiptInserts: [] as Record<string, unknown>[],
    lineItemInserts: [] as Record<string, unknown>[][],
    teamMembershipChecks: [] as Array<{ field: string; value: string }>,
  };

  return {
    calls,
    client: {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.rpc.push({ name, args });

        if (name === 'can_perform_action') {
          return { data: options.canCreate ?? { allowed: true }, error: null };
        }

        if (name === 'match_category_for_receipt') {
          return { data: options.matchedCategoryId ?? null, error: null };
        }

        return { data: null, error: null };
      },
      from: (table: string) => {
        if (table === 'team_members') {
          const conditions: Array<{ field: string; value: string }> = [];

          return {
            select: () => ({
              eq: (field: string, value: string) => {
                conditions.push({ field, value });
                return {
                  eq: (nextField: string, nextValue: string) => {
                    conditions.push({ field: nextField, value: nextValue });
                    return {
                      single: async () => {
                        calls.teamMembershipChecks.push(...conditions);
                        return {
                          data: options.teamMember ?? null,
                          error: options.teamMember ? null : { message: 'Not found' },
                        };
                      },
                    };
                  },
                };
              },
            }),
          };
        }

        if (table === 'receipts') {
          return {
            insert: (payload: Record<string, unknown>) => {
              calls.receiptInserts.push(payload);
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      id: options.receiptId ?? 'receipt-123',
                      ...payload,
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        if (table === 'line_items') {
          return {
            insert: async (payload: Record<string, unknown>[]) => {
              calls.lineItemInserts.push(payload);
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };
}

Deno.test('POST /receipts/quick creates a receipt from the minimal payload with v1 defaults', async () => {
  const expectedDate = new Date().toISOString().split('T')[0];
  const supabase = createSupabaseStub({ matchedCategoryId: 'category-match-1' });
  const context = createApiContext({ supabase: supabase.client });

  const response = await handleQuickReceiptAPI(
    new Request('https://example.com/api/v1/receipts/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: '  Quick Stop  ', total: 12.5 }),
    }),
    context as never,
  );

  const payload = await response.json();

  assertEquals(response.status, 201);
  assertEquals(supabase.calls.receiptInserts.length, 1);
  assertEquals(supabase.calls.receiptInserts[0].merchant, 'Quick Stop');
  assertEquals(supabase.calls.receiptInserts[0].date, expectedDate);
  assertEquals(supabase.calls.receiptInserts[0].currency, 'MYR');
  assertEquals(supabase.calls.receiptInserts[0].status, 'unreviewed');
  assertEquals(supabase.calls.receiptInserts[0].custom_category_id, 'category-match-1');
  assertEquals(payload.success, true);
});

Deno.test('POST /receipts/quick validates the minimal required payload before hitting Supabase', async () => {
  const supabase = createSupabaseStub({});
  const context = createApiContext({ supabase: supabase.client });

  const response = await handleQuickReceiptAPI(
    new Request('https://example.com/api/v1/receipts/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: 'Quick Stop' }),
    }),
    context as never,
  );

  const payload = await response.json();

  assertEquals(response.status, 400);
  assertEquals(payload.message, 'Missing required fields: merchant, total');
  assertEquals(supabase.calls.rpc.length, 0);
  assertEquals(supabase.calls.receiptInserts.length, 0);
});

Deno.test('POST /receipts/quick keeps the shared total validation from generic receipt creation', async () => {
  const supabase = createSupabaseStub({});
  const context = createApiContext({ supabase: supabase.client });

  const response = await handleQuickReceiptAPI(
    new Request('https://example.com/api/v1/receipts/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: 'Quick Stop', total: -1 }),
    }),
    context as never,
  );

  const payload = await response.json();

  assertEquals(response.status, 400);
  assertEquals(payload.message, 'Total must be a positive number');
  assertEquals(supabase.calls.receiptInserts.length, 0);
});

Deno.test('POST /receipts/quick preserves team access checks', async () => {
  const teamId = '2f5309cd-842f-4b77-b4e8-32fa35726f34';
  const supabase = createSupabaseStub({ teamMember: null });
  const context = createApiContext({ supabase: supabase.client });

  const response = await handleQuickReceiptAPI(
    new Request('https://example.com/api/v1/receipts/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: 'Quick Stop', total: 12.5, teamId }),
    }),
    context as never,
  );

  const payload = await response.json();

  assertEquals(response.status, 403);
  assertEquals(payload.message, 'Access denied to team or insufficient permissions');
  assertEquals(supabase.calls.receiptInserts.length, 0);
  assertEquals(supabase.calls.teamMembershipChecks, [
    { field: 'team_id', value: teamId },
    { field: 'user_id', value: '3d5d9f3d-3cf5-4371-a998-a7e9f8c1f001' },
  ]);
});

Deno.test('POST /receipts/quick preserves provided customCategoryId and skips category matching', async () => {
  const customCategoryId = '9a4b4b66-c0c1-4520-b22d-65bf20f3f8b8';
  const supabase = createSupabaseStub({ teamMember: { role: 'member' } });
  const context = createApiContext({ supabase: supabase.client });

  const response = await handleQuickReceiptAPI(
    new Request('https://example.com/api/v1/receipts/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: 'Quick Stop',
        total: 12.5,
        teamId: '2f5309cd-842f-4b77-b4e8-32fa35726f34',
        customCategoryId,
      }),
    }),
    context as never,
  );

  assertEquals(response.status, 201);
  assertEquals(supabase.calls.receiptInserts[0].custom_category_id, customCategoryId);
  assertEquals(
    supabase.calls.rpc.some((call) => call.name === 'match_category_for_receipt'),
    false,
  );
});