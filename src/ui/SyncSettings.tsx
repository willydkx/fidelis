import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSync } from '@/sync/SyncProvider';
import { Body, Button, Caption, Card, Icon, Title } from '@/ui/components';
import { colors, space } from '@/ui/theme';
import { useNow } from '@/ui/useNow';

function ago(time: number, now: number): string {
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

/** Connect Google Drive and see how syncing is going. */
export function SyncSettings() {
  const { account, status, lastSync, error, connect, disconnect, syncNow } = useSync();
  const now = useNow().getTime();

  return (
    <Card style={{ gap: space.lg }}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>Sincronización</Title>
          <Caption>{account ? `Conectada con ${account}` : 'Desactivada'}</Caption>
        </View>
        {status === 'syncing' && <ActivityIndicator color={colors.accent} />}
      </View>

      {!account ? (
        <>
          <Body>
            Mantén tus objetivos y registros iguales en el móvil y el ordenador, de forma automática, a través de tu
            Google Drive.
          </Body>
          <Caption>
            Fidelis solo puede usar una carpeta oculta y propia dentro de tu Drive: no ve tus archivos, tu correo ni tu
            contraseña. Puedes quitarle el acceso cuando quieras desde tu cuenta de Google.
          </Caption>
          <Button label="Conectar con Google" variant="primary" onPress={connect} />
        </>
      ) : (
        <>
          <Caption>
            {status === 'syncing'
              ? 'Sincronizando…'
              : lastSync
                ? `Última sincronización: ${ago(lastSync, now)}.`
                : 'Todavía no se ha sincronizado.'}{' '}
            Se sincroniza sola al abrir la app y al hacer cambios.
          </Caption>
          <View style={styles.buttons}>
            <View style={{ flex: 1 }}>
              <Button label="Sincronizar ahora" onPress={syncNow} disabled={status === 'syncing'} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Desconectar" variant="danger" onPress={disconnect} />
            </View>
          </View>
        </>
      )}

      {error && (
        <View style={styles.row}>
          <Icon android="sync_problem" ios="exclamationmark.icloud" size={18} color={colors.warning} />
          <Caption style={{ color: colors.warning, flex: 1 }}>{error}</Caption>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm },
});
