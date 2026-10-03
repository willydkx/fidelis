import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useData, useDataQuery } from '@/data/DataProvider';
import { Cadence, ObjectiveStatus } from '@/models/enums';
import { isApplicableOn } from '@/models/objective';
import { Body, Card, Caption, EmptyState, Icon, IconButton, SectionHeader } from '@/ui/components';
import { ObjectiveEntryRow } from '@/ui/ObjectiveEntryRow';
import { Screen } from '@/ui/Screen';
import { colors, radius, space } from '@/ui/theme';
import { addDays, formatLong, ISODate, makeDate, today } from '@/utils/dateUtils';

const CADENCE_SECTIONS: [Cadence, string][] = [
  [Cadence.DAILY, 'Diarios'],
  [Cadence.CUSTOM_DAYS, 'Días concretos'],
  [Cadence.WEEKLY, 'Semanales'],
  [Cadence.MONTHLY, 'Mensuales'],
];

function toJsDate(day: ISODate): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function TodayScreen() {
  const { entries, notifyChanged } = useData();
  const [day, setDay] = useState<ISODate>(today());
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const isToday = day === today();

  const data = useDataQuery(
    async ({ objectives, entries, aggregation }) => {
      const applicable = (await objectives.list(ObjectiveStatus.ACTIVE)).filter((o) => isApplicableOn(o, day));
      const dayEntries = new Map((await entries.getEntriesForDate(day)).map((e) => [e.objectiveId, e]));
      const rate = await aggregation.dailyCompletionRate(day, null);
      return { applicable, dayEntries, rate };
    },
    [day],
  );

  const pickDate = (selected: Date | undefined) => {
    if (selected) setDay(makeDate(selected.getFullYear(), selected.getMonth() + 1, selected.getDate()));
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toJsDate(day),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, selected) => event.type === 'set' && pickDate(selected),
      });
    } else {
      setIosPickerOpen((open) => !open);
    }
  };

  const completedCount = data
    ? data.applicable.filter((o) => data.dayEntries.get(o.id)?.completed).length
    : 0;

  return (
    <Screen title={isToday ? 'Hoy' : 'Registro'}>
      <View style={styles.dateRow}>
        <IconButton onPress={() => setDay(addDays(day, -1))} accessibilityLabel="Día anterior">
          <Icon android="chevron_left" ios="chevron.left" />
        </IconButton>
        <Pressable onPress={openPicker} style={styles.dateButton}>
          <Text style={styles.dateText}>{formatLong(day)}</Text>
          {!isToday && <Caption>Toca para elegir otra fecha</Caption>}
        </Pressable>
        <IconButton onPress={() => !isToday && setDay(addDays(day, 1))} accessibilityLabel="Día siguiente">
          <Icon android="chevron_right" ios="chevron.right" color={isToday ? colors.gridline : colors.secondaryInk} />
        </IconButton>
      </View>
      {!isToday && (
        <Pressable onPress={() => setDay(today())} style={styles.backToToday}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Volver a hoy</Text>
        </Pressable>
      )}
      {iosPickerOpen && (
        <DateTimePicker value={toJsDate(day)} mode="date" display="inline" maximumDate={new Date()} onChange={(_, d) => pickDate(d)} />
      )}

      {data && data.applicable.length === 0 && (
        <EmptyState android="event_available" ios="calendar.badge.checkmark" text="No tienes objetivos activos para este día." />
      )}

      {data && data.applicable.length > 0 && (
        <>
          <Card style={{ gap: space.sm }}>
            <Body>
              {completedCount} de {data.applicable.length} objetivos completados
            </Body>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.round(data.rate * 100)}%`, backgroundColor: data.rate >= 1 ? colors.good : colors.accent },
                ]}
              />
            </View>
          </Card>

          {CADENCE_SECTIONS.map(([cadence, title]) => {
            const group = data.applicable.filter((o) => o.cadence === cadence);
            if (!group.length) return null;
            return (
              <View key={cadence} style={{ gap: space.sm }}>
                <SectionHeader>{title}</SectionHeader>
                {group.map((objective) => (
                  <ObjectiveEntryRow
                    key={objective.id}
                    objective={objective}
                    entry={data.dayEntries.get(objective.id)}
                    onChange={async (completed, value) => {
                      await entries.upsertEntry(objective.id, day, { completed, value });
                      notifyChanged();
                    }}
                  />
                ))}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateButton: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  dateText: { color: colors.primaryInk, fontSize: 17, fontWeight: '600', textTransform: 'capitalize' },
  backToToday: { alignSelf: 'center', paddingVertical: space.xs },
  progressTrack: { height: 8, backgroundColor: colors.gridline, borderRadius: radius.pill, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.pill },
});
