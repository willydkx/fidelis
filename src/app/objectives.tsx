import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useData, useDataQuery } from '@/data/DataProvider';
import { ObjectiveStatus } from '@/models/enums';
import { Objective } from '@/models/objective';
import { Caption, EmptyState, Icon, IconButton, SectionHeader } from '@/ui/components';
import { cadenceText, objectiveColor, targetText } from '@/ui/labels';
import { ObjectiveForm } from '@/ui/ObjectiveForm';
import { Screen } from '@/ui/Screen';
import { colors, radius, space } from '@/ui/theme';

export default function ObjectivesScreen() {
  const { objectives: repo, notifyChanged } = useData();
  const [editing, setEditing] = useState<Objective | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const all = useDataQuery(({ objectives }) => objectives.list());
  const active = all?.filter((o) => o.status === ObjectiveStatus.ACTIVE) ?? [];
  const paused = all?.filter((o) => o.status === ObjectiveStatus.PAUSED) ?? [];
  const archived = all?.filter((o) => o.status === ObjectiveStatus.ARCHIVED) ?? [];

  const move = async (index: number, delta: -1 | 1) => {
    const ids = active.map((o) => o.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    // Paused/archived keep their place after the active ones.
    await repo.reorder([...ids, ...paused.map((o) => o.id), ...archived.map((o) => o.id)]);
    notifyChanged();
  };

  const confirmArchive = (objective: Objective) =>
    Alert.alert(
      'Archivar objetivo',
      `¿Archivar "${objective.name}"? Dejará de aparecer en el registro diario, pero conserva su historial.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            await repo.archive(objective.id);
            notifyChanged();
          },
        },
      ],
    );

  const setStatus = async (objective: Objective, status: ObjectiveStatus.ACTIVE | ObjectiveStatus.PAUSED) => {
    await repo.setStatus(objective.id, status);
    notifyChanged();
  };

  return (
    <Screen
      title="Objetivos"
      right={
        <Pressable onPress={() => setEditing('new')} style={styles.addButton} accessibilityLabel="Nuevo objetivo">
          <Icon android="add" ios="plus" color={colors.primaryInk} />
          <Text style={styles.addText}>Nuevo</Text>
        </Pressable>
      }>
      {all && all.length === 0 && (
        <EmptyState android="track_changes" ios="target" text="Todavía no tienes objetivos. Crea el primero con «Nuevo»." />
      )}

      {active.length > 0 && <SectionHeader>Activos</SectionHeader>}
      {active.map((objective, index) => (
        <ObjectiveCard key={objective.id} objective={objective} onPress={() => setEditing(objective)}>
          <IconButton onPress={() => index > 0 && move(index, -1)} accessibilityLabel="Subir">
            <Icon android="arrow_upward" ios="arrow.up" size={18} color={index > 0 ? colors.secondaryInk : colors.gridline} />
          </IconButton>
          <IconButton onPress={() => index < active.length - 1 && move(index, 1)} accessibilityLabel="Bajar">
            <Icon
              android="arrow_downward"
              ios="arrow.down"
              size={18}
              color={index < active.length - 1 ? colors.secondaryInk : colors.gridline}
            />
          </IconButton>
          <IconButton onPress={() => setStatus(objective, ObjectiveStatus.PAUSED)} accessibilityLabel="Pausar">
            <Icon android="pause" ios="pause" size={18} />
          </IconButton>
          <IconButton onPress={() => confirmArchive(objective)} accessibilityLabel="Archivar">
            <Icon android="archive" ios="archivebox" size={18} />
          </IconButton>
        </ObjectiveCard>
      ))}

      {paused.length > 0 && <SectionHeader>Pausados</SectionHeader>}
      {paused.map((objective) => (
        <ObjectiveCard key={objective.id} objective={objective} onPress={() => setEditing(objective)} dimmed>
          <IconButton onPress={() => setStatus(objective, ObjectiveStatus.ACTIVE)} accessibilityLabel="Reanudar">
            <Icon android="play_arrow" ios="play" size={18} />
          </IconButton>
          <IconButton onPress={() => confirmArchive(objective)} accessibilityLabel="Archivar">
            <Icon android="archive" ios="archivebox" size={18} />
          </IconButton>
        </ObjectiveCard>
      ))}

      {archived.length > 0 && (
        <Pressable onPress={() => setShowArchived((s) => !s)}>
          <SectionHeader>
            Archivados ({archived.length}) {showArchived ? '▾' : '▸'}
          </SectionHeader>
        </Pressable>
      )}
      {showArchived &&
        archived.map((objective) => (
          <ObjectiveCard key={objective.id} objective={objective} onPress={() => setEditing(objective)} dimmed>
            <IconButton onPress={() => setStatus(objective, ObjectiveStatus.ACTIVE)} accessibilityLabel="Restaurar">
              <Icon android="unarchive" ios="arrow.uturn.backward" size={18} />
            </IconButton>
          </ObjectiveCard>
        ))}

      <ObjectiveForm
        visible={editing !== null}
        objective={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSubmit={async (values) => {
          if (editing === 'new') {
            await repo.create({ ...values, sortOrder: active.length });
          } else if (editing) {
            await repo.update({ ...editing, ...values });
          }
          setEditing(null);
          notifyChanged();
        }}
        onDelete={async () => {
          if (editing && editing !== 'new') {
            await repo.delete(editing.id);
          }
          setEditing(null);
          notifyChanged();
        }}
      />
    </Screen>
  );
}

function ObjectiveCard({
  objective,
  onPress,
  dimmed,
  children,
}: {
  objective: Objective;
  onPress: () => void;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  const target = targetText(objective);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: dimmed ? 0.6 : pressed ? 0.8 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: objectiveColor(objective) }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={2}>
          {objective.name}
        </Text>
        <Caption>
          {cadenceText(objective)}
          {target ? ` · ${target}` : ''}
        </Caption>
      </View>
      <View style={styles.actions}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingLeft: space.md,
    paddingRight: space.lg,
  },
  addText: { color: colors.primaryInk, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: colors.primaryInk, fontSize: 16 },
  actions: { flexDirection: 'row' },
});
