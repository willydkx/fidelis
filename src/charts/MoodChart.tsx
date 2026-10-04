import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Mood } from '@/repositories/journalRepository';
import { colors } from '@/ui/theme';
import { addDays, daysBetween, ISODate } from '@/utils/dateUtils';

const HEIGHT = 140;
const PAD = { top: 12, right: 10, bottom: 20, left: 32 };
const Y_LABELS: [Mood, string][] = [
  [1, '😞'],
  [3, '😐'],
  [5, '😄'],
];

/** Mood (1-5) of each day in [start, end]; days without one are left as gaps in the line. */
export function MoodChart({ start, end, moods }: { start: ISODate; end: ISODate; moods: Map<ISODate, Mood> }) {
  const [width, setWidth] = useState(0);
  const days = daysBetween(start, end);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (days > 0 ? (i / days) * plotW : plotW / 2);
  const y = (mood: number) => PAD.top + (1 - (mood - 1) / 4) * plotH;

  const points: { i: number; mood: Mood }[] = [];
  for (let i = 0; i <= days; i++) {
    const mood = moods.get(addDays(start, i));
    if (mood) points.push({ i, mood });
  }
  // Join only consecutive days, so a gap doesn't look like a trend.
  const line = points
    .map((p, n) => `${n > 0 && points[n - 1].i === p.i - 1 ? 'L' : 'M'}${x(p.i)},${y(p.mood)}`)
    .join(' ');
  const labelIndexes = [0, Math.floor(days / 2), days];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {Y_LABELS.map(([mood, emoji]) => (
            <SvgText key={mood} x={PAD.left - 8} y={y(mood) + 5} fontSize={14} textAnchor="end">
              {emoji}
            </SvgText>
          ))}
          {Y_LABELS.map(([mood]) => (
            <Line
              key={mood}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(mood)}
              y2={y(mood)}
              stroke={mood === 1 ? colors.baseline : colors.gridline}
              strokeWidth={1}
            />
          ))}
          <Path d={line} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p) => (
            <Circle key={p.i} cx={x(p.i)} cy={y(p.mood)} r={3.5} fill={colors.accent} stroke={colors.surface} strokeWidth={1.5} />
          ))}
          {labelIndexes.map((i, n) => {
            const day = addDays(start, i);
            return (
              <SvgText
                key={n}
                x={x(i)}
                y={HEIGHT - 4}
                fontSize={10}
                fill={colors.mutedInk}
                textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}>
                {day.slice(8, 10) + '/' + day.slice(5, 7)}
              </SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
