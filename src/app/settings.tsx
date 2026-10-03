import Constants from 'expo-constants';

import { Caption } from '@/ui/components';
import { NameSettings } from '@/ui/NameSettings';
import { ReminderSettings } from '@/ui/ReminderSettings';
import { Screen } from '@/ui/Screen';

export default function SettingsScreen() {
  return (
    <Screen title="Ajustes">
      <NameSettings />
      <ReminderSettings />
      <Caption style={{ textAlign: 'center' }}>Fidelis {Constants.expoConfig?.version ?? ''}</Caption>
    </Screen>
  );
}
