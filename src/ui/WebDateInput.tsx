import { colors, radius, space } from '@/ui/theme';
import { ISODate } from '@/utils/dateUtils';

/** The browser's own date picker, for the web version (the community picker is native-only). */
export function WebDateInput({ value, max, onChange }: { value: ISODate; max: ISODate; onChange: (day: ISODate) => void }) {
  return (
    <input
      type="date"
      value={value}
      max={max}
      onChange={(event) => event.target.value && onChange(event.target.value as ISODate)}
      style={{
        alignSelf: 'center',
        colorScheme: 'dark',
        background: colors.surfaceRaised,
        color: colors.primaryInk,
        border: 'none',
        borderRadius: radius.md,
        padding: space.md,
        fontSize: 16,
        fontFamily: 'inherit',
      }}
    />
  );
}
