import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/ui/theme';

export function Screen({
  title,
  right,
  children,
  scroll = true,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {right}
    </View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  title: { color: colors.primaryInk, fontSize: 28, fontWeight: '700' },
});
