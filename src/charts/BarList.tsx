import { StyleSheet, Text, View } from 'react-native';

import { CATEGORICAL, colors, radius, space } from '@/ui/theme';

/** Horizontal bars ranking objectives by average completion (0-1), like ObjectiveBreakdownChart. */
export function BreakdownBars({ items }: { items: { name: string; ratio: number }[] }) {
  return (
    <View style={{ gap: space.md }}>
      {items.map(({ name, ratio }) => {
        const pct = Math.min(ratio, 1) * 100;
        return (
          <View key={name} style={{ gap: space.xs }}>
            <View style={styles.labelRow}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.value}>{pct.toFixed(0)}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${pct}%`, backgroundColor: CATEGORICAL[0] }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Current vs. record streak per objective — two series, so it carries a legend. */
export function StreakBars({ items }: { items: { name: string; current: number; longest: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.longest));
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.legend}>
        <LegendDot color={CATEGORICAL[0]} label="Actual" />
        <LegendDot color={CATEGORICAL[1]} label="Récord" />
      </View>
      {items.map(({ name, current, longest }) => (
        <View key={name} style={{ gap: 3 }}>
          <View style={styles.labelRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.value}>
              {current} / {longest}
            </Text>
          </View>
          <View style={styles.thinTrack}>
            <View style={[styles.bar, { width: `${(current / max) * 100}%`, backgroundColor: CATEGORICAL[0] }]} />
          </View>
          <View style={styles.thinTrack}>
            <View style={[styles.bar, { width: `${(longest / max) * 100}%`, backgroundColor: CATEGORICAL[1] }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={styles.value}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  name: { color: colors.primaryInk, fontSize: 14, flexShrink: 1 },
  value: { color: colors.secondaryInk, fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 8, backgroundColor: colors.gridline, borderRadius: radius.pill, overflow: 'hidden' },
  thinTrack: { height: 5, backgroundColor: colors.gridline, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  legend: { flexDirection: 'row', gap: space.lg },
});
