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
import { isDesktop, scheduleDesktopNotifications } from '@/platform/desktop';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { SettingsRepository } from '@/repositories/settingsRepository';
import { AggregationService } from '@/services/aggregationService';
import { today } from '@/utils/dateUtils';
import { USER_NAME_KEY } from '@/utils/personalization';

const CHANNEL_ID = 'reminders';
const POMODORO_NOTIFICATION_ID = 'pomodoro';
const POMODORO_ALARM_CHANNEL_ID = 'pomodoro-alarm';
const POMODORO_SILENT_CHANNEL_ID = 'pomodoro-silent';
/** Bundled via the expo-notifications plugin (`sounds` in app.json). */
const POMODORO_ALARM_SOUND = 'pomodoro_alarm.wav';
const POMODORO_VIBRATION = [0, 500, 250, 500, 250, 500];
// Up to 5 times × 14 days = 70 alarms, well under Android's 500-per-app limit.
const DAYS_AHEAD = 14;

/**
 * In Expo Go on Android, merely importing expo-notifications throws (it auto-registers for
 * push, which Expo Go no longer supports), so the module is loaded lazily and reminders are
 * simply unavailable there. Development and release builds get the real module. In the
 * browser there are no scheduled notifications; the desktop app shows them itself.
 */
export const remindersSupported =
  isDesktop || (Platform.OS !== 'web' && !(Platform.OS === 'android' && isRunningInExpoGo()));

let notificationsModule: typeof NotificationsModule | null = null;

function loadNotifications(): typeof NotificationsModule | null {
  if (!remindersSupported || isDesktop) {
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
  // The desktop app shows tray notifications, which need no permission.
  if (isDesktop) return true;
  const Notifications = loadNotifications();
  if (!Notifications) {
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorio diario',
      importance: Notifications.AndroidImportance.HIGH,
    });
    // Android fixes a channel's sound once created, so each pomodoro sound mode gets its own.
    await Notifications.setNotificationChannelAsync(POMODORO_ALARM_CHANNEL_ID, {
      name: 'Fin del pomodoro (alarma)',
      importance: Notifications.AndroidImportance.MAX,
      sound: POMODORO_ALARM_SOUND,
      // Alarm usage plays on the alarm volume, so it is heard with the ringer silenced.
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      vibrationPattern: POMODORO_VIBRATION,
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(POMODORO_SILENT_CHANNEL_ID, {
      name: 'Fin del pomodoro (solo vibración)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      vibrationPattern: POMODORO_VIBRATION,
      enableVibrate: true,
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
  if (!isDesktop && (!Notifications || !(await ensureNotificationPermission(false)))) {
    return;
  }
  // Clear previous reminders but leave the running pomodoro's notification alone.
  for (const scheduled of Notifications ? await Notifications.getAllScheduledNotificationsAsync() : []) {
    if (scheduled.identifier !== POMODORO_NOTIFICATION_ID) {
      await Notifications!.cancelScheduledNotificationAsync(scheduled.identifier);
    }
  }

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
  const body = reminderMessage(config, await settings.get(USER_NAME_KEY));

  if (!Notifications) {
    await scheduleDesktopNotifications(
      'reminders',
      moments.map((date) => ({ at: date.getTime(), title: 'Fidelis', body })),
    );
    return;
  }
  for (const date of moments) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Fidelis', body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}

/** Replaces the pomodoro "phase finished" notification; `at: null` just cancels it. */
export async function schedulePomodoroNotification(at: Date | null, body: string, alarmSound = true): Promise<void> {
  if (isDesktop) {
    const upcoming = at && at.getTime() > Date.now();
    await scheduleDesktopNotifications(
      'pomodoro',
      upcoming ? [{ at: at.getTime(), title: 'Fidelis · Enfoque', body, sound: alarmSound }] : [],
    );
    return;
  }
  const Notifications = loadNotifications();
  if (!Notifications || !(await ensureNotificationPermission(false))) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(POMODORO_NOTIFICATION_ID);
  if (at && at.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      identifier: POMODORO_NOTIFICATION_ID,
      content: {
        title: 'Fidelis · Enfoque',
        body,
        sound: alarmSound ? POMODORO_ALARM_SOUND : false,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: alarmSound ? POMODORO_ALARM_CHANNEL_ID : POMODORO_SILENT_CHANNEL_ID,
      },
    });
  }
}
