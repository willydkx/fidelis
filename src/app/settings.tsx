import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { Caption, Card } from '@/ui/components';
import { NameSettings } from '@/ui/NameSettings';
import { ReminderSettings } from '@/ui/ReminderSettings';
import { Screen } from '@/ui/Screen';
import { colors, space } from '@/ui/theme';

// On the web version, tapping the version this many times reveals a small dedication.
const SECRET_TAPS = 5;

export default function SettingsScreen() {
  const [taps, setTaps] = useState(0);
  const revealed = taps >= SECRET_TAPS;

  return (
    <Screen title="Ajustes">
      <NameSettings />
      {Platform.OS === 'web' ? (
        <Caption style={{ textAlign: 'center' }}>
          Versión web: tus datos se guardan solo en este navegador. Si borras los datos del sitio, se pierden.
        </Caption>
      ) : (
        <ReminderSettings />
      )}
      <Pressable onPress={() => setTaps((n) => n + 1)} disabled={Platform.OS !== 'web'} hitSlop={8}>
        <Caption style={{ textAlign: 'center' }}>Fidelis {Constants.expoConfig?.version ?? ''}</Caption>
      </Pressable>
      {Platform.OS === 'web' && revealed && (
        <Card style={styles.secret}>
          <Text style={styles.secretText}>Esta versión es para la mejor novia del mundo.</Text>
          <Text style={styles.secretText}>Te quiero mucho, Jimena.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  secret: { alignItems: 'center', gap: space.xs },
  secretText: { color: colors.primaryInk, fontSize: 15, textAlign: 'center' },
});
