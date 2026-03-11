import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  buildStreakReminderContent,
  isEligibleForStreakReminder,
} from '../_shared/gamification-streak-reminder.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };
}

function isAuthorizedCronRequest(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  return Boolean(supabaseServiceRoleKey && authHeader === `Bearer ${supabaseServiceRoleKey}`);
}

serve(async (req: Request) => {
  const headers = createCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  if (!isAuthorizedCronRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  try {
    const { data: streakStats, error: streakError } = await adminSupabase
      .from('user_gamification_stats')
      .select('user_id, scan_streak_days, last_scan_date')
      .gt('scan_streak_days', 0);

    if (streakError) {
      throw new Error(`Failed to load streak candidates: ${streakError.message}`);
    }

    if (!streakStats || streakStats.length === 0) {
      return new Response(JSON.stringify({ success: true, considered: 0, inserted: 0, skipped: 0 }), {
        status: 200,
        headers,
      });
    }

    const candidateUserIds = streakStats.map((stat) => stat.user_id);
    const existingReminderWindowStart = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString();

    const [profilesResult, preferencesResult, existingRemindersResult] = await Promise.all([
      adminSupabase
        .from('profiles')
        .select('id, timezone_preference')
        .in('id', candidateUserIds),
      adminSupabase
        .from('notification_preferences')
        .select('user_id, push_enabled, push_gamification_streak_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone')
        .in('user_id', candidateUserIds),
      adminSupabase
        .from('notifications')
        .select('recipient_id, metadata, created_at')
        .eq('type', 'gamification_streak_reminder')
        .in('recipient_id', candidateUserIds)
        .gte('created_at', existingReminderWindowStart),
    ]);

    if (profilesResult.error) {
      throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
    }
    if (preferencesResult.error) {
      throw new Error(`Failed to load notification preferences: ${preferencesResult.error.message}`);
    }
    if (existingRemindersResult.error) {
      throw new Error(`Failed to load existing reminders: ${existingRemindersResult.error.message}`);
    }

    const profileMap = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
    const preferencesMap = new Map((preferencesResult.data || []).map((preference) => [preference.user_id, preference]));
    const existingReminderMap = new Map<string, string[]>();

    for (const reminder of existingRemindersResult.data || []) {
      const localDate = reminder.metadata?.local_date;
      if (!localDate) {
        continue;
      }

      const existingDates = existingReminderMap.get(reminder.recipient_id) || [];
      existingDates.push(localDate);
      existingReminderMap.set(reminder.recipient_id, existingDates);
    }

    let inserted = 0;
    let skipped = 0;
    let pushTriggered = 0;

    for (const streakStat of streakStats) {
      const profile = profileMap.get(streakStat.user_id);
      const preferences = preferencesMap.get(streakStat.user_id);
      const eligibility = isEligibleForStreakReminder({
        scanStreakDays: streakStat.scan_streak_days,
        lastScanDate: streakStat.last_scan_date,
        profileTimezone: profile?.timezone_preference,
        preferences,
        existingReminderLocalDates: existingReminderMap.get(streakStat.user_id),
      });

      if (!eligibility.eligible) {
        skipped += 1;
        continue;
      }

      const reminderContent = buildStreakReminderContent(streakStat.scan_streak_days);
      const metadata = {
        local_date: eligibility.localDate,
        scan_streak_days: streakStat.scan_streak_days,
        profile_timezone: eligibility.profileTimezone,
      };

      const { data: notification, error: insertError } = await adminSupabase
        .from('notifications')
        .insert({
          recipient_id: streakStat.user_id,
          type: 'gamification_streak_reminder',
          priority: 'medium',
          title: reminderContent.title,
          message: reminderContent.message,
          action_url: '/dashboard',
          related_entity_type: 'gamification',
          metadata,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          skipped += 1;
          continue;
        }

        throw new Error(`Failed to insert reminder notification: ${insertError.message}`);
      }

      inserted += 1;

      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: streakStat.user_id,
          notificationType: 'gamification_streak_reminder',
          payload: {
            title: reminderContent.title,
            body: reminderContent.message,
            tag: `streak-reminder-${streakStat.user_id}-${eligibility.localDate}`,
            data: {
              notificationId: notification.id,
              actionUrl: '/dashboard',
              type: 'gamification_streak_reminder',
              localDate: eligibility.localDate,
              scanStreakDays: streakStat.scan_streak_days,
            },
          },
          respectPreferences: true,
          respectQuietHours: true,
        }),
      });

      if (pushResponse.ok) {
        pushTriggered += 1;
      } else {
        const errorText = await pushResponse.text();
        console.error('Failed to trigger push delivery for streak reminder:', errorText);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      considered: streakStats.length,
      inserted,
      skipped,
      pushTriggered,
    }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error sending gamification streak reminders:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers,
    });
  }
});