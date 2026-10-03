import { AndroidSymbol, SFSymbol, SymbolView } from 'expo-symbols';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextProps, View, ViewProps } from 'react-native';

import { colors, radius, space, tint } from '@/ui/theme';

export function Icon({
  android,
  ios,
  size = 20,
  color = colors.secondaryInk,
}: {
  android: AndroidSymbol;
  ios: SFSymbol;
  size?: number;
  color?: string;
}) {
  return <SymbolView name={{ android, ios }} size={size} tintColor={color} />;
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function Title({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text style={[styles.body, style]} {...props} />;
}

export function Caption({ style, ...props }: TextProps) {
  return <Text style={[styles.caption, style]} {...props} />;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: tint(color, 0.18) }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const background =
    variant === 'primary' ? colors.accent : variant === 'danger' ? tint(colors.critical, 0.2) : colors.surfaceRaised;
  const textColor = variant === 'danger' ? colors.critical : colors.primaryInk;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}>
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surfaceRaised }]}>
      {children}
    </Pressable>
  );
}

/** Row of mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}>
            <Text style={[styles.segmentText, selected && { color: colors.primaryInk }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ android, ios, text }: { android: AndroidSymbol; ios: SFSymbol; text: string }) {
  return (
    <Card style={styles.empty}>
      <Icon android={android} ios={ios} size={44} color={colors.mutedInk} />
      <Body style={{ color: colors.mutedInk, textAlign: 'center' }}>{text}</Body>
    </Card>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  title: { color: colors.primaryInk, fontSize: 16, fontWeight: '600' },
  body: { color: colors.primaryInk, fontSize: 15 },
  caption: { color: colors.mutedInk, fontSize: 13 },
  sectionHeader: {
    color: colors.secondaryInk,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '500' },
  button: {
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  iconButton: { padding: space.sm, borderRadius: radius.pill },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: 2,
  },
  segment: { flex: 1, paddingVertical: space.sm, borderRadius: radius.md - 2, alignItems: 'center' },
  segmentText: { color: colors.secondaryInk, fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xl * 1.5 },
});
