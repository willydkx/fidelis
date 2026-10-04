import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { remindersSupported } from '@/notifications/reminders';
import { isDesktop } from '@/platform/desktop';
import { googleAuthAvailable } from '@/sync/googleAuth';
import { Caption, Card } from '@/ui/components';
import { DesktopSettings } from '@/ui/DesktopSettings';
import { NameSettings } from '@/ui/NameSettings';
import { ReminderSettings } from '@/ui/ReminderSettings';
import { SyncSettings } from '@/ui/SyncSettings';
import { Screen } from '@/ui/Screen';
import { colors, space } from '@/ui/theme';

// In the browser version, tapping the version this many times reveals a small dedication.
const SECRET_TAPS = 5;
const isBrowser = Platform.OS === 'web' && !isDesktop;

export default function SettingsScreen() {
  const [taps, setTaps] = useState(0);
  const revealed = taps >= SECRET_TAPS;

  return (
    <Screen title="Ajustes">
      <NameSettings />
      {googleAuthAvailable && <SyncSettings />}
      {remindersSupported || !isBrowser ? (
        <ReminderSettings />
      ) : (
        <Caption style={{ textAlign: 'center' }}>
          Versión web: tus datos se guardan solo en este navegador. Si borras los datos del sitio, se pierden.
        </Caption>
      )}
      {isDesktop && <DesktopSettings />}
      <Pressable onPress={() => setTaps((n) => n + 1)} disabled={!isBrowser} hitSlop={8}>
        <Caption style={{ textAlign: 'center' }}>Fidelis {Constants.expoConfig?.version ?? ''}</Caption>
      </Pressable>
      {isBrowser && revealed && (
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
