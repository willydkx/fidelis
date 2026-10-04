import { DarkTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';

import { DataProvider } from '@/data/DataProvider';
import { colors } from '@/ui/theme';
import { FirstLaunchGate } from '@/ui/Welcome';

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.page, card: colors.surface, primary: colors.accent },
};

/** Theme, database and first-launch welcome, shared by every platform's root layout. */
export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <DataProvider>
        <FirstLaunchGate>{children}</FirstLaunchGate>
      </DataProvider>
    </ThemeProvider>
  );
}
