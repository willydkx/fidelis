import { StyleSheet, Text } from 'react-native';

import { BreakdownBars, StreakBars } from '@/charts/BarList';
import { Heatmap } from '@/charts/Heatmap';
import { TrendChart } from '@/charts/TrendChart';
import { useDataQuery } from '@/data/DataProvider';
import { ObjectiveStatus } from '@/models/enums';
import { Caption, Card, EmptyState, Title } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import { colors, space } from '@/ui/theme';
import { addDays, today } from '@/utils/dateUtils';

const SCORE_TIERS: [number, string, string][] = [
  [80, colors.good, 'Excelente'],
  [60, colors.warning, 'Bien, con margen'],
  [40, colors.serious, 'Atención'],
  [0, colors.critical, 'Crítico'],
];

export default function DashboardScreen() {
  const data = useDataQuery(async ({ objectives, aggregation }) => {
    const day = today();
    const year = Number(day.slice(0, 4));
    const active = await objectives.list(ObjectiveStatus.ACTIVE);
    const [score, trend, heatmap] = await Promise.all([
      aggregation.efficiencyScore(day),
      aggregation.completionRatesInRange(addDays(day, -29), day),
      aggregation.heatmapData(year),
    ]);
    const perObjective = await Promise.all(
      active.map(async (o) => ({
        name: o.name,
        current: await aggregation.currentStreak(o, day),
        longest: await aggregation.longestStreak(o, day),
        ratio: await aggregation.averageCompletionRatio(o, day),
      })),
    );
    return { day, year, score, trend: [...trend.entries()], heatmap, perObjective };
  });

  if (!data) {
    return <Screen title="Dashboard">{null}</Screen>;
  }

  if (!data.perObjective.length) {
    return (
      <Screen title="Dashboard">
        <EmptyState android="bar_chart" ios="chart.bar" text="Crea objetivos y empieza a registrarlos para ver tus estadísticas." />
      </Screen>
    );
  }

  const [, scoreColor, scoreText] = SCORE_TIERS.find(([threshold]) => data.score >= threshold) ?? SCORE_TIERS[3];

  return (
    <Screen title="Dashboard">
      <Card style={styles.scoreCard}>
        <Text style={[styles.score, { color: scoreColor }]}>{data.score.toFixed(0)}%</Text>
        <Text style={{ color: scoreColor, fontWeight: '600' }}>{scoreText}</Text>
        <Caption>Eficiencia (últimos 30 días)</Caption>
      </Card>

      <Card style={styles.chartCard}>
        <Title>Cumplimiento diario</Title>
        <TrendChart rates={data.trend} />
      </Card>

      <Card style={styles.chartCard}>
        <Title>Mapa de constancia {data.year}</Title>
        <Heatmap year={data.year} rates={data.heatmap} today={data.day} />
      </Card>

      <Card style={styles.chartCard}>
        <Title>Rachas</Title>
        <StreakBars items={data.perObjective} />
      </Card>

      <Card style={styles.chartCard}>
        <Title>Cumplimiento por objetivo</Title>
        <BreakdownBars items={data.perObjective} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreCard: { alignItems: 'center', gap: space.xs, paddingVertical: space.xl },
  score: { fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chartCard: { gap: space.md },
});
