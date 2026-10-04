import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cadence, TrackingType } from '@/models/enums';
import { NewObjective, Objective } from '@/models/objective';
import { Button, Caption, Icon, IconButton, Segmented, Title } from '@/ui/components';
import { confirmAction } from '@/ui/confirm';
import { WEEKDAY_ABBR } from '@/ui/labels';
import { CATEGORICAL, colors, radius, space } from '@/ui/theme';

const CADENCE_OPTIONS = [
  { value: Cadence.DAILY, label: 'Diaria' },
  { value: Cadence.CUSTOM_DAYS, label: 'Días' },
  { value: Cadence.WEEKLY, label: 'Semanal' },
  { value: Cadence.MONTHLY, label: 'Mensual' },
];
const TRACKING_OPTIONS = [
  { value: TrackingType.BOOLEAN, label: 'Sí / No' },
  { value: TrackingType.NUMERIC, label: 'Numérico' },
];

type FormValues = Required<Omit<NewObjective, 'sortOrder'>>;

function initialValues(objective: Objective | null): FormValues {
  return {
    name: objective?.name ?? '',
    description: objective?.description ?? null,
    cadence: objective?.cadence ?? Cadence.DAILY,
    trackingType: objective?.trackingType ?? TrackingType.BOOLEAN,
    targetValue: objective?.targetValue ?? null,
    unit: objective?.unit ?? null,
    color: objective?.color ?? null,
    daysOfWeek: objective?.daysOfWeek ?? [0, 1, 2, 3, 4],
  };
}

/** Create/edit modal for an objective. */
export function ObjectiveForm({
  visible,
  objective,
  onCancel,
  onSubmit,
  onDelete,
}: {
  visible: boolean;
  objective: Objective | null;
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} presentationStyle="pageSheet">
      {visible && <FormBody objective={objective} onCancel={onCancel} onSubmit={onSubmit} onDelete={onDelete} />}
    </Modal>
  );
}

function FormBody({
  objective,
  onCancel,
  onSubmit,
  onDelete,
}: {
  objective: Objective | null;
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
  onDelete: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(objective));
  const [targetText, setTargetText] = useState(values.targetValue?.toString().replace('.', ',') ?? '');
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const isNumeric = values.trackingType === TrackingType.NUMERIC;
  // A yes/no goal can still ask for N times per week/month; daily ones are just "done".
  const showsTarget = isNumeric || values.cadence === Cadence.WEEKLY || values.cadence === Cadence.MONTHLY;
  const parsedTarget = parseFloat(targetText.replace(',', '.'));

  const errors: string[] = [];
  if (!values.name.trim()) errors.push('Ponle un nombre.');
  if (isNumeric && !(parsedTarget > 0)) errors.push('La meta numérica debe ser mayor que 0.');
  if (values.cadence === Cadence.CUSTOM_DAYS && !values.daysOfWeek?.length) errors.push('Elige al menos un día.');

  const submit = () => {
    if (errors.length) return;
    onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      targetValue: showsTarget && parsedTarget > 0 ? parsedTarget : null,
      unit: isNumeric ? values.unit?.trim() || null : null,
      daysOfWeek: values.cadence === Cadence.CUSTOM_DAYS ? values.daysOfWeek : null,
    });
  };

  const confirmDelete = () =>
    confirmAction({
      title: 'Eliminar objetivo',
      message: `¿Eliminar "${objective?.name}" y todo su historial? No se puede deshacer.

Si solo quieres dejar de verlo, mejor archívalo: conserva sus registros y estadísticas.`,
      confirmLabel: 'Eliminar',
      onConfirm: onDelete,
    });

  const toggleDay = (day: number) => {
    const days = values.daysOfWeek ?? [];
    set('daysOfWeek', days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton onPress={onCancel} accessibilityLabel="Cancelar">
            <Icon android="close" ios="xmark" />
          </IconButton>
          <Title>{objective ? 'Editar objetivo' : 'Nuevo objetivo'}</Title>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Nombre">
            <TextInput
              value={values.name}
              maxLength={100}
              onChangeText={(t) => set('name', t)}
              placeholder="Meditar, leer, correr..."
              placeholderTextColor={colors.mutedInk}
              style={styles.input}
              autoFocus={!objective}
            />
          </Field>

          <Field label="Descripción (opcional)">
            <TextInput
              value={values.description ?? ''}
              maxLength={1000}
              onChangeText={(t) => set('description', t)}
              multiline
              style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
            />
          </Field>

          <Field label="Cadencia">
            <Segmented options={CADENCE_OPTIONS} value={values.cadence} onChange={(c) => set('cadence', c)} />
            {values.cadence === Cadence.CUSTOM_DAYS && (
              <View style={styles.days}>
                {WEEKDAY_ABBR.map((label, day) => {
                  const selected = values.daysOfWeek?.includes(day);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => toggleDay(day)}
                      style={[styles.day, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                      <Text style={[styles.dayText, selected && { color: colors.primaryInk }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Field>

          <Field label="Tipo de seguimiento">
            <Segmented options={TRACKING_OPTIONS} value={values.trackingType} onChange={(t) => set('trackingType', t)} />
          </Field>

          {showsTarget && (
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  label={
                    isNumeric
                      ? 'Meta'
                      : values.cadence === Cadence.WEEKLY
                        ? 'Veces por semana'
                        : 'Veces al mes'
                  }>
                  <TextInput
                    value={targetText}
                    onChangeText={setTargetText}
                    keyboardType="decimal-pad"
                    placeholder={isNumeric ? '10' : '1'}
                    placeholderTextColor={colors.mutedInk}
                    style={styles.input}
                  />
                </Field>
              </View>
              {isNumeric && (
                <View style={{ flex: 1 }}>
                  <Field label="Unidad">
                    <TextInput
                      value={values.unit ?? ''}
                      maxLength={30}
                      onChangeText={(t) => set('unit', t)}
                      placeholder="minutos, páginas..."
                      placeholderTextColor={colors.mutedInk}
                      style={styles.input}
                    />
                  </Field>
                </View>
              )}
            </View>
          )}

          <Field label="Color">
            <View style={styles.swatches}>
              <Swatch color={null} selected={values.color === null} onPress={() => set('color', null)} />
              {CATEGORICAL.map((color) => (
                <Swatch key={color} color={color} selected={values.color === color} onPress={() => set('color', color)} />
              ))}
            </View>
          </Field>

          {errors.length > 0 && <Caption style={{ color: colors.serious }}>{errors[0]}</Caption>}
          <Button label="Guardar" variant="primary" onPress={submit} disabled={errors.length > 0} />
          {objective && <Button label="Eliminar objetivo" variant="danger" onPress={confirmDelete} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Caption>{label}</Caption>
      {children}
    </View>
  );
}

function Swatch({ color, selected, onPress }: { color: string | null; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={color ?? 'Color automático'}
      style={[styles.swatch, { backgroundColor: color ?? colors.surfaceRaised }, selected && styles.swatchSelected]}>
      {color === null && <Text style={{ color: colors.mutedInk, fontSize: 11 }}>auto</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  input: {
    color: colors.primaryInk,
    fontSize: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.baseline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { color: colors.secondaryInk, fontWeight: '600' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 3, borderColor: colors.primaryInk },
});
