import { DEFAULT_REMINDER_TIME } from '@/config';
import { isApplicableOn, Objective } from '@/models/objective';
import { addDays, ISODate, weekday } from '@/utils/dateUtils';
import { fillName } from '@/utils/personalization';

/** Settings key from before reminders were configurable: a single 'HH:MM'. */
export const LEGACY_REMINDER_TIME_KEY = 'daily_reminder_time';
export const REMINDER_CONFIG_KEY = 'reminder_config';

export const MAX_REMINDER_TIMES = 5;
export const DEFAULT_REMINDER_MESSAGE = '{nombre}, todavía tienes objetivos de hoy sin registrar. ¡No rompas la racha!';
export const ALWAYS_REMINDER_MESSAGE = '{nombre}, es hora de registrar tus objetivos de hoy.';

export interface ReminderConfig {
  enabled: boolean;
  /** 'HH:MM', sorted and unique. */
  times: string[];
  /** Weekdays that get reminders, 0=Monday..6=Sunday. */
  days: number[];
  /** Skip days with nothing to log, and skip today's once everything is done. */
  onlyIfPending: boolean;
  /** Empty → default text. May contain {nombre}. */
  message: string;
}

export function defaultReminderConfig(time: string = DEFAULT_REMINDER_TIME): ReminderConfig {
  return { enabled: true, times: [time], days: [0, 1, 2, 3, 4, 5, 6], onlyIfPending: true, message: '' };
}

export function normalizeTimes(times: string[]): string[] {
  return [...new Set(times)].sort().slice(0, MAX_REMINDER_TIMES);
}

/**
 * Reads the stored config. Databases from before this setting existed only have the legacy
 * single time, which becomes the first reminder.
 */
export function parseReminderConfig(stored: string | null, legacyTime: string | null): ReminderConfig {
  const fallback = defaultReminderConfig(legacyTime ?? DEFAULT_REMINDER_TIME);
  if (!stored) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<ReminderConfig>;
    return {
      enabled: parsed.enabled ?? fallback.enabled,
      times: normalizeTimes(parsed.times ?? fallback.times),
      days: [...new Set(parsed.days ?? fallback.days)].sort(),
      onlyIfPending: parsed.onlyIfPending ?? fallback.onlyIfPending,
      message: parsed.message ?? '',
    };
  } catch {
    return fallback;
  }
}

/** The notification text, with {nombre} replaced by the user's name. */
export function reminderMessage(config: ReminderConfig, userName: string | null): string {
  const template = config.message.trim() || (config.onlyIfPending ? DEFAULT_REMINDER_MESSAGE : ALWAYS_REMINDER_MESSAGE);
  return fillName(template, userName);
}

function atTime(day: ISODate, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hour, minute);
}

/**
 * The moments to notify over the next `daysAhead` days, starting today. Reminders are
 * one-shot so today's can be dropped once everything is logged; the app re-plans after
 * every change and on launch.
 */
export function planReminders({
  config,
  activeObjectives,
  startDay,
  now,
  todayComplete,
  daysAhead,
}: {
  config: ReminderConfig;
  activeObjectives: Objective[];
  startDay: ISODate;
  now: Date;
  todayComplete: boolean;
  daysAhead: number;
}): Date[] {
  if (!config.enabled) {
    return [];
  }
  const moments: Date[] = [];
  for (let offset = 0; offset < daysAhead; offset++) {
    const day = addDays(startDay, offset);
    if (!config.days.includes(weekday(day))) continue;
    if (config.onlyIfPending) {
      if (!activeObjectives.some((o) => isApplicableOn(o, day))) continue;
      if (offset === 0 && todayComplete) continue;
    }
    for (const time of config.times) {
      const fireAt = atTime(day, time);
      if (fireAt > now) moments.push(fireAt);
    }
  }
  return moments;
}
