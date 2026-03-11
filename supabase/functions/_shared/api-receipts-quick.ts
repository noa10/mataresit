import type { ApiContext } from './api-auth.ts';
import { hasScope } from './api-auth.ts';

const QUICK_RECEIPT_CURRENCY = 'MYR';
const QUICK_RECEIPT_STATUS = 'unreviewed';

export async function handleQuickReceiptAPI(
  req: Request,
  context: ApiContext,
): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed for /receipts/quick', 405, {
      Allow: 'POST',
    });
  }

  if (!hasScope(context, 'receipts:write')) {
    return createErrorResponse('Insufficient permissions for receipts:write', 403);
  }

  let body: Record<string, unknown>;

  try {
    const parsedBody = await req.json();
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return createErrorResponse('Invalid request body', 400);
    }

    body = parsedBody as Record<string, unknown>;
  } catch (_error) {
    return createErrorResponse('Invalid request body', 400);
  }

  const merchant = body.merchant;
  if (typeof merchant !== 'string' || merchant.trim().length === 0 || body.total === undefined) {
    return createErrorResponse('Missing required fields: merchant, total', 400);
  }

  const normalizedBody = {
    ...body,
    date: body.date ?? getCurrentIsoDate(),
    currency: body.currency ?? QUICK_RECEIPT_CURRENCY,
    status: body.status ?? QUICK_RECEIPT_STATUS,
  };

  const { createReceipt } = await import('./api-receipts.ts');

  return await createReceipt(
    new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(normalizedBody),
    }),
    context,
  );
}

function getCurrentIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function createErrorResponse(
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
      code: status,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    },
  );
}