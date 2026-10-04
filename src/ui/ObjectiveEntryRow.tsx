import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DailyEntry } from '@/models/entry';
import { TrackingType } from '@/models/enums';
import { Objective } from '@/models/objective';
import { Icon, IconButton, Pill } from '@/ui/components';
import { CADENCE_COLORS, CADENCE_LABELS, formatNumber, objectiveColor } from '@/ui/labels';
import { colors, radius, space, tint } from '@/ui/theme';

/** Logs one objective for a single day: a tap-to-toggle card, or a stepper for numeric goals. */
export function ObjectiveEntryRow({
  objective,
  entry,
  onChange,
}: {
  objective: Objective;
  entry: DailyEntry | undefined;
  onChange: (completed: boolean, value: number | null) => void;
}) {
  const accent = objectiveColor(objective);
  const pill = <Pill label={CADENCE_LABELS[objective.cadence].toLowerCase()} color={CADENCE_COLORS[objective.cadence]} />;

  if (objective.trackingType === TrackingType.BOOLEAN) {
    const completed = Boolean(entry?.completed);
    return (
      <Pressable
        onPress={() => onChange(!completed, null)}
        style={({ pressed }) => [styles.row, completed && styles.rowDone, pressed && { opacity: 0.8 }]}>
        <View style={[styles.check, completed ? { backgroundColor: accent, borderColor: accent } : { borderColor: colors.mutedInk }]}>
          {completed && <Icon android="check" ios="checkmark" size={16} color={colors.primaryInk} />}
        </View>
        <Text style={[styles.name, completed && styles.nameDone]} numberOfLines={2}>
          {objective.name}
        </Text>
        {pill}
      </Pressable>
    );
  }

  return <NumericRow objective={objective} entry={entry} onChange={onChange} pill={pill} accent={accent} />;
}

function NumericRow({
  objective,
  entry,
  onChange,
  pill,
  accent,
}: {
  objective: Objective;
  entry: DailyEntry | undefined;
  onChange: (completed: boolean, value: number | null) => void;
  pill: React.ReactNode;
  accent: string;
}) {
  const stored = entry?.value ?? 0;
  // Text being typed; null while not editing so the field always mirrors the stored value.
  const [draft, setDraft] = useState<string | null>(null);

  const target = objective.targetValue ?? 0;
  const completed = target > 0 && stored >= target;

  // Completed once the value reaches a positive target.
  const commit = (value: number) => {
    const clean = Math.max(0, Math.round(value * 10) / 10);
    onChange(target > 0 && clean >= target, clean);
  };

  return (
    <View style={[styles.row, completed && styles.rowDone]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.name, completed && styles.nameDone]} numberOfLines={2}>
          {objective.name}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressBar, { width: `${target > 0 ? Math.min(stored / target, 1) * 100 : 0}%`, backgroundColor: accent }]}
          />
        </View>
        <Text style={styles.meta}>
          meta {formatNumber(target)}
          {objective.unit ? ` ${objective.unit}` : ''}
        </Text>
      </View>
      <View style={styles.stepper}>
        <IconButton onPress={() => commit(stored - 1)} accessibilityLabel="Restar">
          <Icon android="remove" ios="minus" size={18} />
        </IconButton>
        <TextInput
          value={draft ?? formatNumber(stored)}
          onChangeText={setDraft}
          onEndEditing={() => {
            const parsed = parseFloat((draft ?? '').replace(',', '.'));
            if (!Number.isNaN(parsed) && parsed !== stored) commit(parsed);
            setDraft(null);
          }}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={styles.input}
        />
        <IconButton onPress={() => commit(stored + 1)} accessibilityLabel="Sumar">
          <Icon android="add" ios="plus" size={18} />
        </IconButton>
      </View>
      {pill}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 60,
  },
  rowDone: { backgroundColor: tint(colors.good, 0.08), borderColor: tint(colors.good, 0.35) },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, color: colors.primaryInk, fontSize: 16 },
  nameDone: { color: colors.secondaryInk },
  meta: { color: colors.mutedInk, fontSize: 12 },
  progressTrack: { height: 4, backgroundColor: colors.gridline, borderRadius: radius.pill, overflow: 'hidden', marginVertical: 2 },
  progressBar: { height: '100%' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  input: {
    color: colors.primaryInk,
    fontSize: 16,
    minWidth: 48,
    textAlign: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
    // A web <input> is ~20 characters wide by default and would squeeze the name column.
    ...Platform.select({ web: { width: 64 } }),
  },
});
