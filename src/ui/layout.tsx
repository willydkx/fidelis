import { Children, ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { space } from '@/ui/theme';

/** From this window width (desktop and wide browsers) the app uses a sidebar and columns. */
export const WIDE_BREAKPOINT = 900;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/** Side by side on wide windows (widths in proportion to `ratios`), stacked otherwise. */
export function Columns({ children, ratios = [] }: { children: ReactNode; ratios?: number[] }) {
  const wide = useIsWide();
  if (!wide) return <>{children}</>;
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'stretch' }}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ flex: ratios[index] ?? 1, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
