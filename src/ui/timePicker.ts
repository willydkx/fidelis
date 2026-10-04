import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

/** Opens the system time picker; calls `onPicked` with "HH:MM" if the user confirms. */
export function pickTime(initial: string, onPicked: (time: string) => void) {
  const [hour, minute] = initial.split(':').map(Number);
  DateTimePickerAndroid.open({
    value: new Date(2000, 0, 1, hour, minute),
    mode: 'time',
    is24Hour: true,
    onChange: (event, selected) => {
      if (event.type !== 'set' || !selected) return;
      onPicked(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
    },
  });
}
