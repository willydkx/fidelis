import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { ObjectiveStatus } from '@/models/enums';
import {
  LEGACY_REMINDER_TIME_KEY,
  normalizeTimes,
  parseReminderConfig,
  planReminders,
  REMINDER_CONFIG_KEY,
  ReminderConfig,
  reminderMessage,
} from '@/notifications/reminderConfig';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';
import { AggregationService } from '@/services/aggregationService';
import { today } from '@/utils/dateUtils';

const CHANNEL_ID = 'reminders';
// Up to 5 times × 14 days = 70 alarms, well under Android's 500-per-app limit.
const DAYS_AHEAD = 14;

/**
 * In Expo Go on Android, merely importing expo-notifications throws (it auto-registers for
 * push, which Expo Go no longer supports), so the module is loaded lazily and reminders are
 * simply unavailable there. Development and release builds get the real module.
 */
export const remindersSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

let notificationsModule: typeof NotificationsModule | null = null;

function loadNotifications(): typeof NotificationsModule | null {
  if (!remindersSupported) {
    return null;
  }
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see above
    notificationsModule = require('expo-notifications') as typeof NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return notificationsModule;
}

export async function ensureNotificationPermission(ask: boolean): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorio diario',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !ask) {
    return current.granted;
  }
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function loadReminderConfig(settings: SettingsRepository): Promise<ReminderConfig> {
  return parseReminderConfig(await settings.get(REMINDER_CONFIG_KEY), await settings.get(LEGACY_REMINDER_TIME_KEY));
}

export async function saveReminderConfig(settings: SettingsRepository, config: ReminderConfig): Promise<void> {
  await settings.set(REMINDER_CONFIG_KEY, JSON.stringify({ ...config, times: normalizeTimes(config.times) }));
}

/** Replaces all scheduled reminders according to the current config and today's progress. */
export async function rescheduleReminders({
  objectives,
  settings,
  aggregation,
}: {
  objectives: ObjectivesRepository;
  settings: SettingsRepository;
  aggregation: AggregationService;
}): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || !(await ensureNotificationPermission(false))) {
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();

  const config = await loadReminderConfig(settings);
  const startDay = today();
  const moments = planReminders({
    config,
    activeObjectives: await objectives.list(ObjectiveStatus.ACTIVE),
    startDay,
    now: new Date(),
    todayComplete: (await aggregation.dailyCompletionRate(startDay, null)) >= 1,
    daysAhead: DAYS_AHEAD,
  });
  const body = reminderMessage(config);

  for (const date of moments) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Fidelis', body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}
