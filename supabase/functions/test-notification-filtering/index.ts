import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { NotificationHelper } from '../_shared/notification-helper.ts';
import { supabaseClient } from '../_shared/supabase-client.ts';

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

    const { notificationType, userId } = await req.json();

    if (!notificationType || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing notificationType or userId' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get auth header and create supabase client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = supabaseClient(authHeader);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Invalid token', { status: 401 });
    }

    // Use the NotificationHelper to check filtering
    const notificationHelper = new NotificationHelper();
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
