import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useData, useDataQuery } from '@/data/DataProvider';
import {
  MAX_REMINDER_TIMES,
  normalizeTimes,
  ReminderConfig,
  reminderMessage,
} from '@/notifications/reminderConfig';
import {
  ensureNotificationPermission,
  loadReminderConfig,
  remindersSupported,
  saveReminderConfig,
} from '@/notifications/reminders';
import { Body, Button, Caption, Card, Icon, Title } from '@/ui/components';
import { WEEKDAY_ABBR } from '@/ui/labels';
import { colors, radius, space } from '@/ui/theme';
import { NAME_PLACEHOLDER, USER_NAME_KEY } from '@/utils/personalization';

const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Todos', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Laborables', days: [0, 1, 2, 3, 4] },
  { label: 'Fin de semana', days: [5, 6] },
];

function pickTime(initial: string, onPicked: (time: string) => void) {
  const [hour, minute] = initial.split(':').map(Number);
  DateTimePickerAndroid.open({
    value: new Date(2000, 0, 1, hour, minute),
    mode: 'time',
    is24Hour: true,
    onChange: (event, selected) => {
      if (event.type !== 'set' || !selected) return;
      onPicked(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
    },
  });
}

export function ReminderSettings() {
  const { settings, notifyChanged } = useData();
  const data = useDataQuery(async ({ settings }) => ({
    config: await loadReminderConfig(settings),
    notificationsAllowed: await ensureNotificationPermission(false),
    userName: await settings.get(USER_NAME_KEY),
  }));
  // Message being typed; saved when the field loses focus.
  const [messageDraft, setMessageDraft] = useState<string | null>(null);

  if (!data) return null;
  const { config } = data;

  const update = async (changes: Partial<ReminderConfig>) => {
    await saveReminderConfig(settings, { ...config, ...changes });
    notifyChanged();
  };

  const toggleDay = (day: number) =>
    update({ days: config.days.includes(day) ? config.days.filter((d) => d !== day) : [...config.days, day].sort() });

  const editTime = (index: number) =>
    pickTime(config.times[index], (time) =>
      update({ times: normalizeTimes(config.times.map((t, i) => (i === index ? time : t))) }),
    );

  const addTime = () => {
    const last = config.times[config.times.length - 1] ?? '20:00';
    const suggested = `${String((Number(last.slice(0, 2)) + 2) % 24).padStart(2, '0')}:${last.slice(3)}`;
    pickTime(suggested, (time) => update({ times: normalizeTimes([...config.times, time]) }));
  };

  const removeTime = (index: number) => update({ times: config.times.filter((_, i) => i !== index) });

  const enableNotifications = async () => {
    if (!(await ensureNotificationPermission(true))) {
      Alert.alert('Notificaciones desactivadas', 'Actívalas para Fidelis desde los ajustes de Android.');
    }
    notifyChanged();
  };

  const inactive = !config.enabled;
  const noDays = config.enabled && !config.days.length;
  const noTimes = config.enabled && !config.times.length;

  return (
    <Card style={{ gap: space.lg }}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>Recordatorios</Title>
          <Caption>{config.enabled ? 'Activados' : 'Desactivados'}</Caption>
        </View>
        <Switch
          value={config.enabled}
          onValueChange={(enabled) => update({ enabled })}
          trackColor={{ true: colors.accent, false: colors.baseline }}
          thumbColor={colors.primaryInk}
        />
      </View>

      {!remindersSupported && (
        <Warning text="En Expo Go no hay recordatorios. Funcionan al instalar la app como APK." />
      )}
      {remindersSupported && !data.notificationsAllowed && (
        <View style={{ gap: space.sm }}>
          <Warning text="Las notificaciones no están permitidas." />
          <Button label="Permitir notificaciones" variant="primary" onPress={enableNotifications} />
        </View>
      )}

      <View style={[{ gap: space.lg }, inactive && { opacity: 0.4 }]} pointerEvents={inactive ? 'none' : 'auto'}>
        <View style={{ gap: space.sm }}>
          <Caption>Horas</Caption>
          <View style={styles.chips}>
            {config.times.map((time, index) => (
              <View key={time} style={styles.timeChip}>
                <Pressable onPress={() => editTime(index)} hitSlop={6}>
                  <Text style={styles.timeText}>{time}</Text>
                </Pressable>
                <Pressable onPress={() => removeTime(index)} hitSlop={8} accessibilityLabel={`Quitar ${time}`}>
                  <Icon android="close" ios="xmark" size={16} color={colors.mutedInk} />
                </Pressable>
              </View>
            ))}
            {config.times.length < MAX_REMINDER_TIMES && (
              <Pressable onPress={addTime} style={[styles.timeChip, styles.addChip]}>
                <Icon android="add" ios="plus" size={16} color={colors.accent} />
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Añadir</Text>
              </Pressable>
            )}
          </View>
          {noTimes && <Caption style={{ color: colors.warning }}>Añade al menos una hora.</Caption>}
        </View>

        <View style={{ gap: space.sm }}>
          <Caption>Días</Caption>
          <View style={styles.days}>
            {WEEKDAY_ABBR.map((label, day) => {
              const selected = config.days.includes(day);
              return (
                <Pressable
                  key={label}
                  onPress={() => toggleDay(day)}
                  style={[styles.day, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  <Text style={[styles.dayText, selected && { color: colors.primaryInk }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chips}>
            {DAY_PRESETS.map((preset) => (
              <Pressable key={preset.label} onPress={() => update({ days: preset.days })} style={styles.preset}>
                <Text style={styles.presetText}>{preset.label}</Text>
              </Pressable>
            ))}
          </View>
          {noDays && <Caption style={{ color: colors.warning }}>Elige al menos un día.</Caption>}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body>Solo si me faltan objetivos</Body>
            <Caption>
              {config.onlyIfPending
                ? 'No avisa si ya lo has completado todo o ese día no tienes objetivos.'
                : 'Avisa siempre a las horas elegidas.'}
            </Caption>
          </View>
          <Switch
            value={config.onlyIfPending}
            onValueChange={(onlyIfPending) => update({ onlyIfPending })}
            trackColor={{ true: colors.accent, false: colors.baseline }}
            thumbColor={colors.primaryInk}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Caption>Mensaje</Caption>
          <TextInput
            value={messageDraft ?? config.message}
            onChangeText={setMessageDraft}
            onEndEditing={async () => {
              if (messageDraft !== null && messageDraft !== config.message) {
                await update({ message: messageDraft.trim() });
              }
              setMessageDraft(null);
            }}
            placeholder={reminderMessage({ ...config, message: '' }, data.userName)}
            placeholderTextColor={colors.mutedInk}
            multiline
            maxLength={160}
            style={styles.input}
          />
          <Caption>Déjalo vacío para usar el mensaje por defecto. Escribe {NAME_PLACEHOLDER} donde quieras que aparezca tu nombre.</Caption>
        </View>
      </View>
    </Card>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <View style={styles.warning}>
      <Icon android="notifications" ios="bell.slash" size={18} color={colors.warning} />
      <Caption style={{ color: colors.warning, flex: 1 }}>{text}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  warning: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  addChip: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent, gap: space.xs },
  timeText: { color: colors.primaryInk, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.baseline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { color: colors.secondaryInk, fontWeight: '600' },
  preset: { paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  presetText: { color: colors.secondaryInk, fontSize: 13 },
  input: {
    color: colors.primaryInk,
    fontSize: 15,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 56,
    textAlignVertical: 'top',
  },
});
