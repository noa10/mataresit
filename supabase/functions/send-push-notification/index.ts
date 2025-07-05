import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// VAPID keys for push notifications
// In production, these should be stored as environment variables
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BEl62iUYgUivxIkv69yViEuiBIa40HcCWLEaQK07x8hiKAantUM4hM5CxbxrwhHuFAU2dX4tnMJiHG9AJL0x8cs';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'your-vapid-private-key-here';
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@mataresit.com';

// Create Supabase client
const supabaseClient = (authHeader: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
};

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: {
    notificationId?: string;
    actionUrl?: string;
    type?: string;
    priority?: string;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

interface SendPushRequest {
  userId?: string;
  userIds?: string[];
  teamId?: string;
  notificationType: string;
  payload: PushNotificationPayload;
  respectPreferences?: boolean;
  respectQuietHours?: boolean;
}

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

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = supabaseClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response('Invalid token', { status: 401 });
    }

    // Parse request body
    const requestBody: SendPushRequest = await req.json();
    const { 
      userId, 
      userIds, 
      teamId, 
      notificationType, 
      payload, 
      respectPreferences = true,
      respectQuietHours = true 
    } = requestBody;

    console.log('Push notification request:', {
      userId,
      userIds: userIds?.length,
      teamId,
      notificationType,
      respectPreferences,
      respectQuietHours
    });

    // Determine target users
    let targetUserIds: string[] = [];
    
    if (userId) {
      targetUserIds = [userId];
    } else if (userIds) {
      targetUserIds = userIds;
    } else if (teamId) {
      // Get all team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('status', 'active');
      
      if (teamError) {
        throw new Error(`Failed to get team members: ${teamError.message}`);
      }
      
      targetUserIds = teamMembers?.map(member => member.user_id) || [];
    } else {
      return new Response('No target users specified', { status: 400 });
    }

    if (targetUserIds.length === 0) {
      return new Response('No valid target users found', { status: 400 });
    }

    console.log(`Sending push notifications to ${targetUserIds.length} users`);

    // Process each user
    const results = await Promise.allSettled(
      targetUserIds.map(async (targetUserId) => {
        return await sendPushToUser(
          supabase,
          targetUserId,
          notificationType,
          payload,
          respectPreferences,
          respectQuietHours
        );
      })
    );

    // Count successes and failures
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    console.log(`Push notification results: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: successful,
      failed: failed,
      total: targetUserIds.length
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function sendPushToUser(
  supabase: any,
  userId: string,
  notificationType: string,
  payload: PushNotificationPayload,
  respectPreferences: boolean,
  respectQuietHours: boolean
): Promise<void> {
  try {
    // Check user preferences if required
    if (respectPreferences) {
      const { data: preferences } = await supabase.rpc('get_user_notification_preferences', {
        _user_id: userId
      });

      const userPrefs = preferences?.[0];
      if (!userPrefs?.push_enabled) {
        console.log(`Push notifications disabled for user ${userId}`);
        return;
      }

      // Check specific notification type preference
      const prefKey = `push_${notificationType}`;
      if (userPrefs[prefKey] === false) {
        console.log(`Push notification type ${notificationType} disabled for user ${userId}`);
        return;
      }

      // Check quiet hours if required
      if (respectQuietHours && userPrefs.quiet_hours_enabled) {
        const isQuietTime = await checkQuietHours(userPrefs);
        if (isQuietTime) {
          console.log(`User ${userId} is in quiet hours, skipping push notification`);
          return;
        }
      }
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (subError) {
      throw new Error(`Failed to get subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active push subscriptions for user ${userId}`);
      return;
    }

    // Send push notification to each subscription
    const pushPromises = subscriptions.map(async (subscription: any) => {
      return await sendWebPush(subscription, payload);
    });

    await Promise.allSettled(pushPromises);
    console.log(`Push notifications sent to user ${userId}`);

  } catch (error) {
    console.error(`Failed to send push to user ${userId}:`, error);
    throw error;
  }
}

async function sendWebPush(subscription: any, payload: PushNotificationPayload): Promise<void> {
  try {
    // Prepare the push subscription object
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key
      }
    };

    // For now, we'll use a simple fetch to a web push service
    // In production, you'd want to use a proper web push library
    console.log('Would send web push notification:', {
      subscription: pushSubscription.endpoint,
      payload: payload.title
    });

    // TODO: Implement actual web push sending using web-push library
    // This requires importing the web-push library in Deno
    // For now, we'll just log the attempt

  } catch (error) {
    console.error('Failed to send web push:', error);
    throw error;
  }
}

async function checkQuietHours(preferences: any): Promise<boolean> {
  if (!preferences.quiet_hours_enabled || !preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  try {
    const now = new Date();
    const timezone = preferences.timezone || 'Asia/Kuala_Lumpur';
    
    // Get current time in user's timezone
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }).format(now);

    const [currentHour, currentMinute] = userTime.split(':').map(Number);
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = preferences.quiet_hours_start.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = preferences.quiet_hours_end.split(':').map(Number);
    const endTimeMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTimeMinutes > endTimeMinutes) {
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    } else {
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
}
