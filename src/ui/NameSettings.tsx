import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { remindersSupported } from '@/notifications/reminders';
import { useData, useDataQuery } from '@/data/DataProvider';
import { Caption, Card, Title } from '@/ui/components';
import { colors, radius, space } from '@/ui/theme';
import { MAX_NAME_LENGTH, USER_NAME_KEY } from '@/utils/personalization';

export function NameSettings() {
  const { settings, notifyChanged } = useData();
  const stored = useDataQuery(async ({ settings }) => (await settings.get(USER_NAME_KEY)) ?? '');
  // Text being typed; saved when the field loses focus.
  const [draft, setDraft] = useState<string | null>(null);

  if (stored === null) return null;

  return (
    <Card style={{ gap: space.md }}>
      <Title>Tu nombre</Title>
      <TextInput
        value={draft ?? stored}
        onChangeText={setDraft}
        onEndEditing={async () => {
          if (draft !== null && draft.trim() !== stored) {
            await settings.set(USER_NAME_KEY, draft.trim());
            notifyChanged();
          }
          setDraft(null);
        }}
        placeholder="Sin nombre"
        placeholderTextColor={colors.mutedInk}
        autoCapitalize="words"
        autoComplete="given-name"
        maxLength={MAX_NAME_LENGTH}
        returnKeyType="done"
        style={styles.input}
      />
      <Caption>
        Se usa en el saludo de la pantalla Hoy{!remindersSupported ? '.' : ' y en los recordatorios.'}
      </Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    color: colors.primaryInk,
    fontSize: 17,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
