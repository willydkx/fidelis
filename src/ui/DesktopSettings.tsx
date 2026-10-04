import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { callHost } from '@/platform/desktop';
import { Body, Caption, Card, Title } from '@/ui/components';
import { colors, space } from '@/ui/theme';

/** Options that only exist in the Windows desktop app. */
export function DesktopSettings() {
  const [startWithWindows, setStartWithWindows] = useState<boolean | null>(null);

  useEffect(() => {
    callHost<boolean>('autostart.get').then(setStartWithWindows, () => setStartWithWindows(null));
  }, []);

  const toggle = async (enabled: boolean) => {
    setStartWithWindows(enabled);
    try {
      await callHost('autostart.set', enabled);
    } catch {
      setStartWithWindows(!enabled);
    }
  };

  return (
    <Card style={{ gap: space.lg }}>
      <Title>Escritorio</Title>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>Abrir al iniciar Windows</Body>
          <Caption>Fidelis se abre sola al encender el ordenador.</Caption>
        </View>
        <Switch
          value={startWithWindows ?? false}
          disabled={startWithWindows === null}
          onValueChange={toggle}
          trackColor={{ true: colors.accent, false: colors.baseline }}
          thumbColor={colors.primaryInk}
        />
      </View>
      <Caption>
        Al cerrar la ventana, Fidelis sigue junto al reloj para avisarte de los recordatorios y del pomodoro, casi
        sin gastar memoria. Para salir del todo, haz clic derecho en su icono y elige «Salir».
      </Caption>
      <Caption>
        Atajos de teclado: ← y → cambian de día en Hoy (H vuelve a hoy), Espacio inicia o pausa el pomodoro y N crea un
        objetivo nuevo.
      </Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
