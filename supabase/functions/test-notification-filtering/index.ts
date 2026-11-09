import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { EdgeNotificationHelper } from '../_shared/notification-helper.ts';
import { isPrivileged, isSelf, resolveCaller } from '../_shared/function-auth.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const caller = await resolveCaller(req);
    if (!caller) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { notificationType, userId } = await req.json();

    if (!notificationType || typeof userId !== 'string' || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing notificationType or userId' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // The preference lookup runs with the caller's session. A caller may only
    // inspect their own preferences unless they are privileged.
    if (!isPrivileged(caller) && !isSelf(caller, userId)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Use the NotificationHelper to check filtering
    const notificationHelper = new EdgeNotificationHelper(
      req.headers.get('Authorization') ?? undefined
    );
    const result = await notificationHelper.checkNotificationPreferences(userId, notificationType);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('Error in test-notification-filtering:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});
