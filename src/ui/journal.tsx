import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useData, useDataQuery } from '@/data/DataProvider';
import { JOURNAL_MAX_LENGTH, JournalEntry, Mood } from '@/repositories/journalRepository';
import { Caption, Card, EmptyState, Icon, IconButton, Title } from '@/ui/components';
import { colors, radius, space, tint } from '@/ui/theme';
import { formatLong, ISODate, today } from '@/utils/dateUtils';

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Muy mal' },
  { value: 2, emoji: '😕', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Muy bien' },
];

export const moodEmoji = (mood: Mood) => MOODS[mood - 1].emoji;

const SAVE_DELAY_MS = 800;

/** "sábado, 3 de octubre", adding the year when it isn't this one. */
function formatJournalDate(day: ISODate): string {
  const year = day.slice(0, 4);
  return year === today().slice(0, 4) ? formatLong(day) : `${formatLong(day)} de ${year}`;
}

/**
 * "¿Qué tal el día?" on the Today screen. Saves by itself shortly after typing stops, when
 * the field loses focus and when the day changes (the card is keyed by day).
 */
export function JournalCard({ day, onOpenJournal }: { day: ISODate; onOpenJournal: () => void }) {
  const { journal, notifyChanged } = useData();
  const stored = useDataQuery(({ journal }) => journal.get(day), [day]);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved'>('idle');

  // What gets saved: kept in a ref so the save timer and the unmount flush see the latest.
  const draft = useRef<{ text: string; mood: Mood | null; dirty: boolean }>({ text: '', mood: null, dirty: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show what's stored (also after a sync), unless there are unsaved edits.
  useEffect(() => {
    if (draft.current.dirty) return;
    draft.current = { text: stored?.text ?? '', mood: stored?.mood ?? null, dirty: false };
    setText(draft.current.text);
    setMood(draft.current.mood);
  }, [stored]);

  const save = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!draft.current.dirty) return;
    draft.current.dirty = false;
    const changed = await journal.save(day, { text: draft.current.text, mood: draft.current.mood });
    setStatus('saved');
    if (changed) notifyChanged();
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(
    () => () => {
      saveRef.current().catch((error) => console.warn('[Fidelis] journal save', error));
    },
    [],
  );

  const edited = (next: { text?: string; mood?: Mood | null }, delay: number) => {
    if (next.text !== undefined) {
      setText(next.text);
      draft.current.text = next.text;
    }
    if (next.mood !== undefined) {
      setMood(next.mood);
      draft.current.mood = next.mood;
    }
    draft.current.dirty = true;
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveRef.current().catch((error) => console.warn('[Fidelis] journal save', error));
    }, delay);
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.cardHeader}>
        <Title>¿Qué tal el día?</Title>
        <Pressable onPress={onOpenJournal} hitSlop={8}>
          <Text style={styles.link}>Ver diario</Text>
        </Pressable>
      </View>
      <View style={styles.moods}>
        {MOODS.map((m) => {
          const selected = mood === m.value;
          return (
            <Pressable
              key={m.value}
              onPress={() => edited({ mood: selected ? null : m.value }, 0)}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              accessibilityState={{ selected }}
              style={[styles.mood, selected && styles.moodSelected, mood !== null && !selected && styles.moodDimmed]}>
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={text}
        onChangeText={(t) => edited({ text: t }, SAVE_DELAY_MS)}
        onBlur={() => saveRef.current().catch((error) => console.warn('[Fidelis] journal save', error))}
        multiline
        maxLength={JOURNAL_MAX_LENGTH}
        placeholder="Escribe cómo te ha ido, qué ha pasado, qué quieres recordar…"
        placeholderTextColor={colors.mutedInk}
        style={styles.input}
      />
      <Caption style={{ alignSelf: 'flex-end' }}>
        {status === 'pending' ? 'Guardando…' : status === 'saved' ? 'Guardado' : ' '}
      </Caption>
    </Card>
  );
}

/** Every diary entry, newest first, with a search box. Picking one opens that day. */
export function JournalModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (day: ISODate) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      {visible && <JournalList onClose={onClose} onSelect={onSelect} />}
    </Modal>
  );
}

function JournalList({ onClose, onSelect }: { onClose: () => void; onSelect: (day: ISODate) => void }) {
  const [search, setSearch] = useState('');
  const entries = useDataQuery(({ journal }) => journal.list(search), [search]);
  const searching = search.trim() !== '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton onPress={onClose} accessibilityLabel="Cerrar">
          <Icon android="close" ios="xmark" />
        </IconButton>
        <Title>Diario</Title>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.listColumn}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar en el diario"
          placeholderTextColor={colors.mutedInk}
          style={[styles.input, styles.search]}
        />
        {entries && entries.length === 0 && (
          <EmptyState
            android={searching ? 'search_off' : 'edit_note'}
            ios={searching ? 'magnifyingglass' : 'square.and.pencil'}
            text={
              searching
                ? 'No hay ningún día que contenga ese texto.'
                : 'Aún no has escrito nada. Hazlo desde la pantalla Hoy, en «¿Qué tal el día?».'
            }
          />
        )}
        {entries && entries.length > 0 && (
          <FlatList
            data={entries}
            keyExtractor={(e) => e.date}
            contentContainerStyle={{ gap: space.md, paddingBottom: space.xl * 2 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <JournalItem entry={item} onOpenDay={() => onSelect(item.date)} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const PREVIEW_LINES = 2;
// Rough guess of what fits in two lines, to decide whether to offer "Leer más".
const PREVIEW_CHARS = 110;

/** A day in the list: a short preview that opens up to the full text when tapped. */
function JournalItem({ entry, onOpenDay }: { entry: JournalEntry; onOpenDay: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const text = entry.text.trim();
  const isLong = text.length > PREVIEW_CHARS || text.split('\n').length > PREVIEW_LINES;
  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Card style={{ gap: space.sm }}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemDate}>{formatJournalDate(entry.date)}</Text>
          {entry.mood !== null && <Text style={styles.itemMood}>{moodEmoji(entry.mood)}</Text>}
        </View>
        {text !== '' && (
          <Text style={styles.itemText} numberOfLines={expanded ? undefined : PREVIEW_LINES}>
            {text}
          </Text>
        )}
        {expanded ? (
          <Pressable onPress={onOpenDay} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <Text style={styles.link}>Editar este día</Text>
          </Pressable>
        ) : (
          isLong && <Caption>Toca para leer más</Caption>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.accent, fontWeight: '600' },
  moods: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  mood: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceRaised,
  },
  moodSelected: { borderColor: colors.accent, backgroundColor: tint(colors.accent, 0.18) },
  moodDimmed: { opacity: 0.45 },
  moodEmoji: { fontSize: 26 },
  input: {
    color: colors.primaryInk,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: colors.page,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.md,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  safe: { flex: 1, backgroundColor: colors.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listColumn: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: space.lg, gap: space.md },
  search: { minHeight: 0, backgroundColor: colors.surface },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  itemDate: { color: colors.primaryInk, fontSize: 15, fontWeight: '600', textTransform: 'capitalize', flexShrink: 1 },
  itemMood: { fontSize: 20 },
  itemText: { color: colors.secondaryInk, fontSize: 15, lineHeight: 21 },
});
