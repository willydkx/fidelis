import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { RootProviders } from '@/ui/RootProviders';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <RootProviders>
      <NativeTabs
        backgroundColor={colors.surface}
        indicatorColor={colors.surfaceRaised}
        iconColor={{ default: colors.mutedInk, selected: colors.accent }}
        labelStyle={{ default: { color: colors.mutedInk }, selected: { color: colors.primaryInk } }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Hoy</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="checkmark.circle" md="event_available" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="focus">
          <NativeTabs.Trigger.Label>Enfoque</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="timer" md="timer" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="dashboard">
          <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="objectives">
          <NativeTabs.Trigger.Label>Objetivos</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="target" md="track_changes" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </RootProviders>
  );
}
