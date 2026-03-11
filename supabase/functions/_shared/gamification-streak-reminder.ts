import { isInQuietHours, type PushNotificationPreferences } from './notification-preferences.ts';

const DEFAULT_TIMEZONE = 'Asia/Kuala_Lumpur';

export interface StreakReminderCandidate {
  scanStreakDays: number;
  lastScanDate?: string | null;
  profileTimezone?: string | null;
  preferences?: PushNotificationPreferences | null;
  existingReminderLocalDates?: string[];
}

export interface StreakReminderEligibility {
  eligible: boolean;
  localDate: string;
  profileTimezone: string;
  reason?:
    | 'no_active_streak'
    | 'already_scanned_today'
    | 'push_disabled'
    | 'reminders_disabled'
    | 'quiet_hours'
    | 'already_sent_today';
}

export function getLocalDateForTimezone(
  now = new Date(),
  timezone = DEFAULT_TIMEZONE
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function isEligibleForStreakReminder(
  candidate: StreakReminderCandidate,
  now = new Date()
): StreakReminderEligibility {
  const profileTimezone = candidate.profileTimezone || DEFAULT_TIMEZONE;
  const localDate = getLocalDateForTimezone(now, profileTimezone);
  const preferences = candidate.preferences || {};
  const quietHoursTimezone = preferences.timezone || profileTimezone;

  if (candidate.scanStreakDays <= 0) {
    return { eligible: false, localDate, profileTimezone, reason: 'no_active_streak' };
  }

  if (candidate.lastScanDate === localDate) {
    return { eligible: false, localDate, profileTimezone, reason: 'already_scanned_today' };
  }

  if (preferences.push_enabled === false) {
    return { eligible: false, localDate, profileTimezone, reason: 'push_disabled' };
  }

  if (preferences.push_gamification_streak_reminders === false) {
    return { eligible: false, localDate, profileTimezone, reason: 'reminders_disabled' };
  }

  if (isInQuietHours(preferences, quietHoursTimezone, now)) {
    return { eligible: false, localDate, profileTimezone, reason: 'quiet_hours' };
  }

  if (candidate.existingReminderLocalDates?.includes(localDate)) {
    return { eligible: false, localDate, profileTimezone, reason: 'already_sent_today' };
  }

  return { eligible: true, localDate, profileTimezone };
}

export function buildStreakReminderContent(scanStreakDays: number): {
  title: string;
  message: string;
} {
  return {
    title: 'Keep your scan streak alive',
    message: `You haven't scanned a receipt today yet. Scan one now to keep your ${scanStreakDays}-day streak going.`,
  };
}