import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useDataQuery } from '@/data/DataProvider';
import { ObjectiveStatus, TrackingType } from '@/models/enums';
import { remindersSupported } from '@/notifications/reminders';
import { formatClock, LIMITS, Phase, PHASE_LABELS, phaseDurationMs } from '@/pomodoro/pomodoro';
import { usePomodoro } from '@/pomodoro/usePomodoro';
import { Body, Caption, Card, Icon, IconButton, Title } from '@/ui/components';
import { formatNumber, objectiveColor } from '@/ui/labels';
import { Screen } from '@/ui/Screen';
import { CATEGORICAL, colors, radius, space, tint } from '@/ui/theme';

const PHASE_COLORS: Record<Phase, string> = {
  work: colors.accent,
  shortBreak: CATEGORICAL[1],
  longBreak: CATEGORICAL[4],
};

const RING_SIZE = 260;
const RING_STROKE = 14;

export default function FocusScreen() {
  const pomodoro = usePomodoro();
  const [customizing, setCustomizing] = useState(false);

  // Numeric objectives measured in minutes can receive the focus time.
  const minuteObjectives = useDataQuery(async ({ objectives }) =>
    (await objectives.list(ObjectiveStatus.ACTIVE)).filter(
      (o) => o.trackingType === TrackingType.NUMERIC && /min/i.test(o.unit ?? ''),
    ),
  );

  if (!pomodoro.ready) {
    return <Screen title="Enfoque">{null}</Screen>;
  }
  const config = pomodoro.config!;
  const state = pomodoro.state!;
  const { stats, remaining } = pomodoro;

  const color = PHASE_COLORS[state.phase];
  const total = phaseDurationMs(state.phase, config);
  const progress = total > 0 ? 1 - remaining / total : 0;
  const radiusPx = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radiusPx;

  const sessionNumber = state.phase === 'work' ? state.sessionsDone + 1 : state.sessionsDone;
  const statusText =
    state.status === 'paused'
      ? 'En pausa'
      : state.phase === 'work'
        ? `Sesión ${Math.min(sessionNumber, config.sessionsUntilLongBreak)} de ${config.sessionsUntilLongBreak}`
        : state.status === 'idle'
          ? 'Listo para descansar'
          : 'Descansando';

  const linked = minuteObjectives?.find((o) => o.id === config.linkedObjectiveId) ?? null;

  return (
    <Screen title="Enfoque">
      <View style={styles.phases}>
        {(Object.keys(PHASE_LABELS) as Phase[]).map((phase) => {
          const active = phase === state.phase;
          return (
            <View
              key={phase}
              style={[styles.phasePill, active && { backgroundColor: tint(PHASE_COLORS[phase], 0.18) }]}>
              <Text style={[styles.phaseText, active && { color: PHASE_COLORS[phase] }]}>{PHASE_LABELS[phase]}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radiusPx}
            stroke={colors.gridline}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radiusPx}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.clock}>{formatClock(remaining)}</Text>
          <Text style={[styles.status, { color }]}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.cycle}>
        {Array.from({ length: config.sessionsUntilLongBreak }, (_, i) => (
          <View key={i} style={[styles.cycleDot, i < state.sessionsDone && { backgroundColor: PHASE_COLORS.work }]} />
        ))}
      </View>

      <View style={styles.controls}>
        <IconButton onPress={pomodoro.resetPhase} accessibilityLabel="Reiniciar fase">
          <Icon android="replay" ios="arrow.counterclockwise" size={26} />
        </IconButton>
        <Pressable
          onPress={pomodoro.toggle}
          accessibilityLabel={state.status === 'running' ? 'Pausar' : 'Iniciar'}
          style={({ pressed }) => [styles.mainButton, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}>
          <Icon
            android={state.status === 'running' ? 'pause' : 'play_arrow'}
            ios={state.status === 'running' ? 'pause.fill' : 'play.fill'}
            size={38}
            color={colors.primaryInk}
          />
        </Pressable>
        <IconButton onPress={pomodoro.skip} accessibilityLabel="Saltar fase">
          <Icon android="skip_next" ios="forward.end" size={26} />
        </IconButton>
      </View>

      <Card style={styles.todayCard}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.statValue}>{stats.sessions}</Text>
          <Caption>sesiones hoy</Caption>
        </View>
        <View style={styles.divider} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.statValue}>{stats.minutes}</Text>
          <Caption>min de enfoque</Caption>
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <Title>Sumar el tiempo a un objetivo</Title>
        <Caption>Cada sesión de enfoque terminada suma sus minutos al registro de hoy.</Caption>
        {minuteObjectives && minuteObjectives.length === 0 ? (
          <Caption style={{ color: colors.secondaryInk }}>
            Crea un objetivo numérico en minutos (por ejemplo «Estudiar») para poder vincularlo.
          </Caption>
        ) : (
          <View style={styles.chips}>
            <Chip
              label="Ninguno"
              selected={linked === null}
              onPress={() => pomodoro.updateConfig({ linkedObjectiveId: null })}
            />
            {minuteObjectives?.map((o) => (
              <Chip
                key={o.id}
                label={o.name}
                color={objectiveColor(o)}
                selected={linked?.id === o.id}
                onPress={() => pomodoro.updateConfig({ linkedObjectiveId: o.id })}
              />
            ))}
          </View>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <Pressable onPress={() => setCustomizing((c) => !c)} style={styles.row}>
          <Title style={{ flex: 1 }}>Personalizar</Title>
          <Caption>
            {config.workMinutes}/{config.shortBreakMinutes}/{config.longBreakMinutes} min
          </Caption>
          <Icon
            android={customizing ? 'expand_less' : 'expand_more'}
            ios={customizing ? 'chevron.up' : 'chevron.down'}
            size={22}
          />
        </Pressable>
        {customizing && (
          <View style={{ gap: space.md }}>
            <Stepper
              label="Enfoque"
              unit="min"
              value={config.workMinutes}
              step={5}
              limits={[5, LIMITS.workMinutes[1]]}
              onChange={(workMinutes) => pomodoro.updateConfig({ workMinutes })}
            />
            <Stepper
              label="Descanso corto"
              unit="min"
              value={config.shortBreakMinutes}
              step={1}
              limits={LIMITS.shortBreakMinutes}
              onChange={(shortBreakMinutes) => pomodoro.updateConfig({ shortBreakMinutes })}
            />
            <Stepper
              label="Descanso largo"
              unit="min"
              value={config.longBreakMinutes}
              step={5}
              limits={[5, LIMITS.longBreakMinutes[1]]}
              onChange={(longBreakMinutes) => pomodoro.updateConfig({ longBreakMinutes })}
            />
            <Stepper
              label="Sesiones hasta el descanso largo"
              value={config.sessionsUntilLongBreak}
              step={1}
              limits={LIMITS.sessionsUntilLongBreak}
              onChange={(sessionsUntilLongBreak) => pomodoro.updateConfig({ sessionsUntilLongBreak })}
            />
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Body>Empezar la siguiente fase solo</Body>
                <Caption>Al acabar un enfoque arranca el descanso, y viceversa.</Caption>
              </View>
              <Switch
                value={config.autoStart}
                onValueChange={(autoStart) => pomodoro.updateConfig({ autoStart })}
                trackColor={{ true: colors.accent, false: colors.baseline }}
                thumbColor={colors.primaryInk}
              />
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Body>Alarma con sonido</Body>
                <Caption>
                  {Platform.OS === 'web'
                    ? 'En la versión web el aviso suena solo si Fidelis sigue abierta.'
                    : config.alarmSound
                      ? 'Suena con el volumen de alarma, así que normalmente se oye aunque el móvil esté en silencio.'
                      : 'Al terminar, el aviso solo vibra.'}
                </Caption>
              </View>
              <Switch
                value={config.alarmSound}
                onValueChange={(alarmSound) => pomodoro.updateConfig({ alarmSound })}
                trackColor={{ true: colors.accent, false: colors.baseline }}
                thumbColor={colors.primaryInk}
              />
            </View>
            {Platform.OS === 'android' && remindersSupported && (
              <View style={{ gap: space.sm }}>
                <Caption>
                  Para que el aviso llegue justo a su hora, Fidelis necesita permiso de «Alarmas y recordatorios». En
                  Android 14 o superior hay que activarlo a mano en los ajustes de la app.
                </Caption>
                <Pressable onPress={() => Linking.openSettings()} style={styles.resetCycle} hitSlop={8}>
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>Abrir ajustes de Fidelis</Text>
                </Pressable>
              </View>
            )}
            <Caption>Los cambios de duración se aplican a la siguiente fase si ya has empezado la actual.</Caption>
            <Pressable onPress={pomodoro.resetCycle} style={styles.resetCycle} hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Reiniciar ciclo</Text>
            </Pressable>
          </View>
        )}
      </Card>
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
  color = colors.accent,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: tint(color, 0.2), borderColor: color }]}>
      <Text style={[styles.chipText, selected && { color: colors.primaryInk }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({
  label,
  unit,
  value,
  step,
  limits: [min, max],
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  step: number;
  limits: readonly [number, number];
  onChange: (value: number) => void;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <View style={styles.row}>
      <Body style={{ flex: 1 }}>{label}</Body>
      <IconButton onPress={() => set(value - step)} accessibilityLabel={`Restar ${label}`}>
        <Icon android="remove" ios="minus" size={18} color={value <= min ? colors.gridline : colors.secondaryInk} />
      </IconButton>
      <Text style={styles.stepperValue}>
        {formatNumber(value)}
        {unit ? ` ${unit}` : ''}
      </Text>
      <IconButton onPress={() => set(value + step)} accessibilityLabel={`Sumar ${label}`}>
        <Icon android="add" ios="plus" size={18} color={value >= max ? colors.gridline : colors.secondaryInk} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  phases: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  phasePill: { paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill },
  phaseText: { color: colors.mutedInk, fontSize: 13, fontWeight: '600' },
  ringWrap: { alignSelf: 'center', width: RING_SIZE, height: RING_SIZE, marginVertical: space.md },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  clock: { color: colors.primaryInk, fontSize: 60, fontWeight: '300', fontVariant: ['tabular-nums'] },
  status: { fontSize: 15, fontWeight: '600' },
  cycle: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  cycleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gridline },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    marginVertical: space.md,
  },
  mainButton: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  todayCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  statValue: { color: colors.primaryInk, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.baseline,
    borderRadius: radius.pill,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md,
    maxWidth: '100%',
  },
  chipText: { color: colors.secondaryInk, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepperValue: {
    color: colors.primaryInk,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resetCycle: { alignSelf: 'flex-start', paddingVertical: space.xs },
});
