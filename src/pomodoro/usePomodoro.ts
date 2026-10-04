import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';

import { useData } from '@/data/DataProvider';
import { ObjectiveStatus, TrackingType } from '@/models/enums';
import { remindersSupported, schedulePomodoroNotification } from '@/notifications/reminders';
import { prepareAlarm, ringAlarm } from '@/pomodoro/phaseAlarm';
import {
  addToStats,
  advance,
  applyConfig,
  parseConfig,
  parseState,
  parseStats,
  pause,
  phaseEndMessage,
  phaseMinutes,
  POMODORO_CONFIG_KEY,
  POMODORO_STATE_KEY,
  POMODORO_STATS_KEY,
  PomodoroConfig,
  PomodoroState,
  PomodoroStats,
  remainingMs,
  resetCycle,
  resetPhase,
  start,
} from '@/pomodoro/pomodoro';
import { today } from '@/utils/dateUtils';
import { fillName, USER_NAME_KEY } from '@/utils/personalization';

// If the app comes back more than this long after a phase ended, don't auto-start the next
// one "from now" — the user clearly wasn't there.
const AUTO_START_GRACE_MS = 60_000;

export function usePomodoro() {
  const { settings, objectives, entries, notifyChanged } = useData();
  const [config, setConfig] = useState<PomodoroConfig | null>(null);
  const [state, setState] = useState<PomodoroState | null>(null);
  const [stats, setStats] = useState<PomodoroStats | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadedConfig = parseConfig(await settings.get(POMODORO_CONFIG_KEY));
      const loadedState = parseState(await settings.get(POMODORO_STATE_KEY), loadedConfig);
      const loadedStats = parseStats(await settings.get(POMODORO_STATS_KEY), today());
      if (!cancelled) {
        setConfig(loadedConfig);
        setState(loadedState);
        setStats(loadedStats);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings]);

  const running = state?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    const subscription = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [running]);

  /** Saves the new state and keeps the "phase finished" notification in step with it. */
  const commit = useCallback(
    async (next: PomodoroState, activeConfig: PomodoroConfig) => {
      setState(next);
      setNow(Date.now());
      await settings.set(POMODORO_STATE_KEY, JSON.stringify(next));
      if (next.status === 'running') {
        const following = advance(next, activeConfig, 0, true).state.phase;
        const body = fillName(phaseEndMessage(next.phase, following, activeConfig), await settings.get(USER_NAME_KEY));
        await schedulePomodoroNotification(new Date(next.endsAt!), body, activeConfig.alarmSound);
      } else {
        await schedulePomodoroNotification(null, '');
      }
    },
    [settings],
  );

  /** Adds a finished session's minutes to today's entry of the linked numeric objective. */
  const logMinutes = useCallback(
    async (objectiveId: number, minutes: number) => {
      const objective = await objectives.get(objectiveId);
      if (
        !objective ||
        objective.status !== ObjectiveStatus.ACTIVE ||
        objective.trackingType !== TrackingType.NUMERIC
      ) {
        return;
      }
      const day = today();
      const existing = (await entries.getEntriesForDate(day)).find((e) => e.objectiveId === objectiveId);
      const value = (existing?.value ?? 0) + minutes;
      const target = objective.targetValue ?? 0;
      await entries.upsertEntry(objectiveId, day, {
        completed: target > 0 && value >= target,
        value,
        note: existing?.note ?? '',
      });
      notifyChanged();
    },
    [objectives, entries, notifyChanged],
  );

  const finishPhase = useCallback(
    async (completed: boolean) => {
      if (!state || !config || finishing.current) return;
      finishing.current = true;
      try {
        const late = completed && state.endsAt !== null && Date.now() - state.endsAt > AUTO_START_GRACE_MS;
        const effectiveConfig = late ? { ...config, autoStart: false } : config;
        const { state: next, finishedWork } = advance(state, effectiveConfig, Date.now(), completed);

        if (completed && !late) {
          if (Platform.OS === 'web') {
            const body = phaseEndMessage(state.phase, next.phase, config);
            ringAlarm(fillName(body, await settings.get(USER_NAME_KEY)), config.alarmSound);
          } else if (!remindersSupported) {
            // With notifications available, the phase-end notification vibrates/rings on its own.
            Vibration.vibrate([0, 400, 200, 400]);
          }
        }
        if (finishedWork) {
          const minutes = phaseMinutes('work', config);
          const updated = addToStats(stats, today(), minutes);
          setStats(updated);
          await settings.set(POMODORO_STATS_KEY, JSON.stringify(updated));
          if (config.linkedObjectiveId !== null) await logMinutes(config.linkedObjectiveId, minutes);
        }
        await commit(next, config);
      } finally {
        finishing.current = false;
      }
    },
    [state, config, stats, settings, logMinutes, commit],
  );

  // The phase ran out (checked on every tick and when the app returns to the foreground).
  useEffect(() => {
    if (state?.status === 'running' && remainingMs(state, now) === 0) {
      finishPhase(true);
    }
  }, [state, now, finishPhase]);

  const updateConfig = useCallback(
    async (changes: Partial<PomodoroConfig>) => {
      if (!config || !state) return;
      const next = { ...config, ...changes };
      setConfig(next);
      await settings.set(POMODORO_CONFIG_KEY, JSON.stringify(next));
      const adjusted = applyConfig(state, config, next);
      if (adjusted !== state) await commit(adjusted, next);
    },
    [config, state, settings, commit],
  );

  const ready = config !== null && state !== null && stats !== null;
  const todayStats = stats && stats.day === today() ? stats : { day: today(), sessions: 0, minutes: 0 };

  return {
    ready,
    config,
    state,
    stats: todayStats,
    remaining: state ? remainingMs(state, now) : 0,
    toggle: () => {
      if (!state || !config) return;
      if (state.status !== 'running') prepareAlarm();
      commit(state.status === 'running' ? pause(state, Date.now()) : start(state, Date.now()), config);
    },
    resetPhase: () => state && config && commit(resetPhase(state, config), config),
    resetCycle: () => config && commit(resetCycle(config), config),
    skip: () => finishPhase(false),
    updateConfig,
  };
}
