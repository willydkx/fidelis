import { useRef } from 'react';
import { ScrollView } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { WEEKDAY_ABBR } from '@/ui/labels';
import { colors, SEQUENTIAL_BLUE } from '@/ui/theme';
import { addDays, daysBetween, ISODate, makeDate, weekday } from '@/utils/dateUtils';

const CELL = 13;
const GAP = 3;
const LABEL_W = 16;
const HEADER_H = 16;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function cellColor(rate: number | undefined, isFuture: boolean): string {
  if (isFuture || rate === undefined) return colors.gridline;
  if (rate <= 0) return '#1d232a';
  const index = Math.min(SEQUENTIAL_BLUE.length - 1, Math.floor(Math.min(rate, 1) * SEQUENTIAL_BLUE.length));
  return SEQUENTIAL_BLUE[index];
}

/** GitHub-style yearly heatmap (weeks as columns, Monday on top), scrolled to the current week. */
export function Heatmap({ year, rates, today }: { year: number; rates: Map<ISODate, number>; today: ISODate }) {
  const scrollRef = useRef<ScrollView>(null);
  const jan1 = makeDate(year, 1, 1);
  const firstMonday = addDays(jan1, -weekday(jan1));
  const weeks = Math.floor(daysBetween(firstMonday, makeDate(year, 12, 31)) / 7) + 1;
  const width = LABEL_W + weeks * (CELL + GAP);
  const height = HEADER_H + 7 * (CELL + GAP);

  const cells = [];
  const monthLabels = [];
  for (let week = 0; week < weeks; week++) {
    const monday = addDays(firstMonday, week * 7);
    for (let dow = 0; dow < 7; dow++) {
      const day = addDays(monday, dow);
      if (!day.startsWith(String(year))) continue;
      cells.push(
        <Rect
          key={day}
          x={LABEL_W + week * (CELL + GAP)}
          y={HEADER_H + dow * (CELL + GAP)}
          width={CELL}
          height={CELL}
          rx={3}
          fill={cellColor(rates.get(day), day > today)}
        />,
      );
    }
    // Label the week that contains the 1st of each month.
    const sunday = addDays(monday, 6);
    if (sunday.startsWith(String(year)) && (sunday.slice(8) <= '07' || week === 0)) {
      const month = Number(sunday.slice(5, 7));
      monthLabels.push(
        <SvgText key={month} x={LABEL_W + week * (CELL + GAP)} y={11} fontSize={10} fill={colors.mutedInk}>
          {MONTHS[month - 1]}
        </SvgText>,
      );
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      ref={scrollRef}
      onContentSizeChange={() => {
        const todayWeek = Math.floor(daysBetween(firstMonday, today) / 7);
        scrollRef.current?.scrollTo({ x: Math.max(0, LABEL_W + (todayWeek - 18) * (CELL + GAP)), animated: false });
      }}>
      <Svg width={width} height={height}>
        {[0, 2, 4].map((dow) => (
          <SvgText key={dow} x={0} y={HEADER_H + dow * (CELL + GAP) + 10} fontSize={9} fill={colors.mutedInk}>
            {WEEKDAY_ABBR[dow]}
          </SvgText>
        ))}
        {monthLabels}
        {cells}
      </Svg>
    </ScrollView>
  );
}
