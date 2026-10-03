import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { ISODate } from '@/utils/dateUtils';
import { colors, tint } from '@/ui/theme';

const HEIGHT = 160;
const PAD = { top: 8, right: 8, bottom: 20, left: 32 };

/** Single-series daily completion line (0-100 %). */
export function TrendChart({ rates }: { rates: [ISODate, number][] }) {
  const [width, setWidth] = useState(0);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (rates.length > 1 ? (i / (rates.length - 1)) * plotW : plotW / 2);
  const y = (rate: number) => PAD.top + (1 - rate) * plotH;

  const line = rates.map(([, rate], i) => `${i ? 'L' : 'M'}${x(i)},${y(rate)}`).join(' ');
  const area = rates.length ? `${line} L${x(rates.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';
  const labelIndexes = rates.length ? [0, Math.floor((rates.length - 1) / 2), rates.length - 1] : [];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {[0, 0.5, 1].map((tick) => (
            <Line
              key={tick}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? colors.baseline : colors.gridline}
              strokeWidth={1}
            />
          ))}
          {[0, 0.5, 1].map((tick) => (
            <SvgText key={tick} x={PAD.left - 6} y={y(tick) + 4} fontSize={10} fill={colors.mutedInk} textAnchor="end">
              {`${tick * 100}%`}
            </SvgText>
          ))}
          <Path d={area} fill={tint(colors.accent, 0.12)} />
          <Path d={line} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {labelIndexes.map((i, n) => (
            <SvgText
              key={i}
              x={x(i)}
              y={HEIGHT - 4}
              fontSize={10}
              fill={colors.mutedInk}
              textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}>
              {rates[i][0].slice(8, 10) + '/' + rates[i][0].slice(5, 7)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}
