import { Tabs } from 'expo-router';
import { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/components';
import { useIsWide } from '@/ui/layout';
import { RootProviders } from '@/ui/RootProviders';
import { colors, radius, space } from '@/ui/theme';

// Same sections as the Android tabs (_layout.tsx).
const SECTIONS: { name: string; title: string; android: AndroidSymbol; ios: SFSymbol }[] = [
  { name: 'index', title: 'Hoy', android: 'event_available', ios: 'checkmark.circle' },
  { name: 'focus', title: 'Enfoque', android: 'timer', ios: 'timer' },
  { name: 'dashboard', title: 'Dashboard', android: 'bar_chart', ios: 'chart.bar' },
  { name: 'objectives', title: 'Objetivos', android: 'track_changes', ios: 'target' },
  { name: 'settings', title: 'Ajustes', android: 'settings', ios: 'gearshape' },
];

/**
 * Browser and desktop navigation: a sidebar on wide windows, a bottom bar like Android's
 * on narrow ones.
 */
export default function RootLayout() {
  const wide = useIsWide();
  return (
    <RootProviders>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarPosition: wide ? 'left' : 'bottom',
          tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
          tabBarActiveTintColor: colors.primaryInk,
          tabBarInactiveTintColor: colors.mutedInk,
          tabBarActiveBackgroundColor: wide ? colors.surfaceRaised : undefined,
          tabBarStyle: wide ? styles.sidebar : styles.bottomBar,
          tabBarItemStyle: wide ? styles.sidebarItem : undefined,
          tabBarLabelStyle: wide ? styles.sidebarLabel : styles.bottomLabel,
          tabBarBackground: wide ? () => <SidebarHeader /> : undefined,
        }}>
        {SECTIONS.map(({ name, title, android, ios }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarIcon: ({ focused, size }) => (
                <Icon android={android} ios={ios} size={wide ? 20 : size} color={focused ? colors.accent : colors.mutedInk} />
              ),
            }}
          />
        ))}
      </Tabs>
    </RootProviders>
  );
}

function SidebarHeader() {
  return (
    <View style={styles.brand}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <Text style={styles.brandText}>Fidelis</Text>
    </View>
  );
}

const SIDEBAR_WIDTH = 220;

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    // React Navigation's default sidebar is much wider (up to 360).
    minWidth: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightColor: colors.border,
    paddingTop: 76,
    paddingHorizontal: space.sm,
  },
  sidebarItem: {
    flexGrow: 0,
    justifyContent: 'flex-start',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: space.xs,
    height: 42,
  },
  sidebarLabel: { fontSize: 15, fontWeight: '600', marginLeft: space.md },
  bottomBar: { backgroundColor: colors.surface, borderTopColor: colors.border },
  bottomLabel: { fontSize: 11, fontWeight: '600' },
  brand: {
    position: 'absolute',
    top: space.xl,
    left: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  logo: { width: 28, height: 28, borderRadius: 7 },
  brandText: { color: colors.primaryInk, fontSize: 18, fontWeight: '700' },
});
