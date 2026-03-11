import { describe, expect, it } from 'vitest';
import {
  buildStreakReminderContent,
  getLocalDateForTimezone,
  isEligibleForStreakReminder,
} from '../../../supabase/functions/_shared/gamification-streak-reminder.ts';

describe('gamification streak reminder eligibility', () => {
  it('is eligible when the user has an active streak, has not scanned today, and reminders are enabled', () => {
    const now = new Date('2026-03-10T08:00:00.000Z');

    expect(
      isEligibleForStreakReminder(
        {
          scanStreakDays: 4,
          lastScanDate: '2026-03-09',
          profileTimezone: 'Asia/Kuala_Lumpur',
          preferences: {
            push_enabled: true,
            push_gamification_streak_reminders: true,
          },
        },
        now
      )
    ).toEqual({
      eligible: true,
      localDate: '2026-03-10',
      profileTimezone: 'Asia/Kuala_Lumpur',
    });
  });

  it('uses the profile timezone when deciding whether the user already scanned today', () => {
    const now = new Date('2026-03-10T01:30:00.000Z');

    expect(getLocalDateForTimezone(now, 'America/Los_Angeles')).toBe('2026-03-09');
    expect(
      isEligibleForStreakReminder(
        {
          scanStreakDays: 8,
          lastScanDate: '2026-03-09',
          profileTimezone: 'America/Los_Angeles',
          preferences: {
            push_enabled: true,
            push_gamification_streak_reminders: true,
          },
        },
        now
      ).reason
    ).toBe('already_scanned_today');
  });

  it('skips reminders during quiet hours using the notification preference timezone fallback', () => {
    const now = new Date('2026-03-10T14:30:00.000Z');

    expect(
      isEligibleForStreakReminder(
        {
          scanStreakDays: 6,
          lastScanDate: '2026-03-09',
          profileTimezone: 'UTC',
          preferences: {
            push_enabled: true,
            push_gamification_streak_reminders: true,
            quiet_hours_enabled: true,
            quiet_hours_start: '22:00',
            quiet_hours_end: '07:00',
            timezone: 'Asia/Kuala_Lumpur',
          },
        },
        now
      ).reason
    ).toBe('quiet_hours');
  });

  it('skips users who already received a reminder for their current local day', () => {
    const now = new Date('2026-03-10T08:00:00.000Z');

    expect(
      isEligibleForStreakReminder(
        {
          scanStreakDays: 3,
          lastScanDate: '2026-03-09',
          profileTimezone: 'Asia/Kuala_Lumpur',
          existingReminderLocalDates: ['2026-03-10'],
          preferences: {
            push_enabled: true,
            push_gamification_streak_reminders: true,
          },
        },
        now
      ).reason
    ).toBe('already_sent_today');
  });

  it('builds reminder copy that includes the current streak length', () => {
    expect(buildStreakReminderContent(7)).toEqual({
      title: 'Keep your scan streak alive',
      message: "You haven't scanned a receipt today yet. Scan one now to keep your 7-day streak going.",
    });
  });
});