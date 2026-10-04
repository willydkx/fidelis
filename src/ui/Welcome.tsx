import { ReactNode, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useData, useDataQuery } from '@/data/DataProvider';
import { NewObjective } from '@/models/objective';
import { ensureNotificationPermission, remindersSupported } from '@/notifications/reminders';
import { AreaId, AREAS, Level, suggestObjectives } from '@/onboarding/catalog';
import { Button, Caption, Icon, IconButton } from '@/ui/components';
import { cadenceText, targetText } from '@/ui/labels';
import { colors, radius, space, tint } from '@/ui/theme';
import { MAX_NAME_LENGTH, USER_NAME_KEY } from '@/utils/personalization';

/** Shows the welcome flow until the user has entered (or skipped) their name. */
export function FirstLaunchGate({ children }: { children: ReactNode }) {
  const profile = useDataQuery(async ({ settings, objectives }) => ({
    name: await settings.get(USER_NAME_KEY),
    hasObjectives: (await objectives.list()).length > 0,
  }));
  if (!profile) {
    return <View style={styles.safe} />;
  }
  // Users who already have objectives (e.g. updating from an older version) only get asked their name.
  return profile.name === null ? <Welcome askForObjectives={!profile.hasObjectives} /> : children;
}

type Step = 'name' | 'areas' | 'level' | 'suggestions';

const LEVELS: { id: Level; emoji: string; label: string; description: string }[] = [
  { id: 'gentle', emoji: '🌱', label: 'Suave', description: 'Metas pequeñas para crear el hábito sin agobios.' },
  { id: 'ambitious', emoji: '🔥', label: 'Ambicioso', description: 'Metas más exigentes si ya tienes algo de rodaje.' },
];

function Welcome({ askForObjectives }: { askForObjectives: boolean }) {
  const { settings, objectives, notifyChanged } = useData();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  // Keys of the suggestions the user has ticked; seeded when the list is first shown.
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const suggestions = level ? suggestObjectives(areas, level) : [];

  const finish = async (chosenName: string, toCreate: NewObjective[]) => {
    for (const [index, objective] of toCreate.entries()) {
      await objectives.create({ ...objective, sortOrder: index });
    }
    await settings.set(USER_NAME_KEY, chosenName.trim());
    await ensureNotificationPermission(true).catch(() => false);
    notifyChanged();
  };

  const afterName = (chosenName: string) => {
    setName(chosenName);
    if (askForObjectives) setStep('areas');
    else finish(chosenName, []);
  };

  const chooseLevel = (chosen: Level) => {
    setLevel(chosen);
    setPicked(
      new Set(
        suggestObjectives(areas, chosen)
          .filter((s) => s.preselected)
          .map((s) => s.key),
      ),
    );
    setStep('suggestions');
  };

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const steps: Step[] = askForObjectives ? ['name', 'areas', 'level', 'suggestions'] : ['name'];
  const back = () => setStep(steps[Math.max(0, steps.indexOf(step) - 1)]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {steps.length > 1 && (
          <View style={styles.topBar}>
            {step !== 'name' ? (
              <IconButton onPress={back} accessibilityLabel="Atrás">
                <Icon android="chevron_left" ios="chevron.left" />
              </IconButton>
            ) : (
              <View style={{ width: 36 }} />
            )}
            <View style={styles.dots}>
              {steps.map((s) => (
                <View key={s} style={[styles.dot, s === step && styles.dotActive]} />
              ))}
            </View>
            <View style={{ width: 36 }} />
          </View>
        )}

        {step === 'name' && (
          <View style={[styles.content, { justifyContent: 'center' }]}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
            <Text style={styles.title}>Bienvenido a Fidelis</Text>
            <Caption style={styles.subtitle}>
              {!remindersSupported
                ? 'Registra tus objetivos cada día y mira tus rachas crecer.'
                : 'Registra tus objetivos cada día, mira tus rachas y recibe recordatorios para no romperlas.'}
            </Caption>
            <View style={styles.form}>
              <Text style={styles.question}>¿Cómo te llamas?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onSubmitEditing={() => name.trim() && afterName(name)}
                placeholder="Tu nombre"
                placeholderTextColor={colors.mutedInk}
                autoFocus
                autoCapitalize="words"
                autoComplete="given-name"
                maxLength={MAX_NAME_LENGTH}
                returnKeyType="next"
                style={styles.input}
              />
              <Caption>
                {!remindersSupported ? 'Lo usaremos para saludarte.' : 'Lo usaremos para saludarte y en los recordatorios.'}{' '}
                Puedes cambiarlo en Ajustes.
              </Caption>
              <Button label="Continuar" variant="primary" onPress={() => afterName(name)} disabled={!name.trim()} />
              <Pressable onPress={() => afterName('')} style={styles.skip} hitSlop={8}>
                <Text style={styles.skipText}>Ahora no</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'areas' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{name.trim() ? `${name.trim()}, ¿qué` : '¿Qué'} quieres mejorar?</Text>
            <Caption style={styles.subtitle}>Elige una o varias áreas y te sugerimos objetivos para empezar.</Caption>
            <View style={styles.options}>
              {AREAS.map((area) => {
                const selected = areas.includes(area.id);
                return (
                  <Option
                    key={area.id}
                    emoji={area.emoji}
                    label={area.label}
                    description={area.description}
                    color={area.color}
                    selected={selected}
                    onPress={() => setAreas(toggle(areas, area.id))}
                  />
                );
              })}
            </View>
            <Button label="Continuar" variant="primary" onPress={() => setStep('level')} disabled={!areas.length} />
            <Pressable onPress={() => finish(name, [])} style={styles.skip} hitSlop={8}>
              <Text style={styles.skipText}>Empezar de cero, sin sugerencias</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === 'level' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>¿Cómo quieres empezar?</Text>
            <Caption style={styles.subtitle}>Ajusta las metas sugeridas. Podrás cambiarlas cuando quieras.</Caption>
            <View style={styles.options}>
              {LEVELS.map((l) => (
                <Option
                  key={l.id}
                  emoji={l.emoji}
                  label={l.label}
                  description={l.description}
                  color={colors.accent}
                  selected={level === l.id}
                  onPress={() => chooseLevel(l.id)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {step === 'suggestions' && (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>Tus objetivos sugeridos</Text>
              <Caption style={styles.subtitle}>
                Hemos marcado unos pocos para empezar sin agobios. Marca o desmarca los que quieras.
              </Caption>
              {AREAS.filter((a) => areas.includes(a.id)).map((area) => (
                <View key={area.id} style={{ gap: space.sm }}>
                  <Text style={styles.areaHeader}>
                    {area.emoji} {area.label}
                  </Text>
                  {suggestions
                    .filter((s) => s.area === area.id)
                    .map((s) => {
                      const selected = picked.has(s.key);
                      const target = targetText(s.objective);
                      return (
                        <Pressable
                          key={s.key}
                          onPress={() => {
                            const next = new Set(picked);
                            if (selected) next.delete(s.key);
                            else next.add(s.key);
                            setPicked(next);
                          }}
                          style={[
                            styles.suggestion,
                            selected && { borderColor: area.color, backgroundColor: tint(area.color, 0.1) },
                          ]}>
                          <View
                            style={[
                              styles.check,
                              selected
                                ? { backgroundColor: area.color, borderColor: area.color }
                                : { borderColor: colors.mutedInk },
                            ]}>
                            {selected && <Icon android="check" ios="checkmark" size={14} color={colors.primaryInk} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionName}>{s.objective.name}</Text>
                            <Caption>
                              {cadenceText(s.objective)}
                              {target ? ` · ${target}` : ''}
                            </Caption>
                          </View>
                        </Pressable>
                      );
                    })}
                </View>
              ))}
            </ScrollView>
            <View style={styles.footer}>
              <Button
                label={
                  picked.size ? `Crear ${picked.size} objetivo${picked.size === 1 ? '' : 's'}` : 'Empezar sin objetivos'
                }
                variant="primary"
                onPress={() =>
                  finish(
                    name,
                    suggestions.filter((s) => picked.has(s.key)).map((s) => s.objective),
                  )
                }
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Option({
  emoji,
  label,
  description,
  color,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  description: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && { borderColor: color, backgroundColor: tint(color, 0.12) }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Caption>{description}</Caption>
      </View>
      {selected && <Icon android="check" ios="checkmark" size={20} color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.baseline },
  dotActive: { width: 22, backgroundColor: colors.accent },
  content: { flexGrow: 1, padding: space.xl, gap: space.md },
  logo: { width: 96, height: 96, alignSelf: 'center', marginBottom: space.md },
  title: { color: colors.primaryInk, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 15, lineHeight: 21, marginBottom: space.sm },
  form: { gap: space.md, marginTop: space.xl },
  question: { color: colors.primaryInk, fontSize: 18, fontWeight: '600' },
  input: {
    color: colors.primaryInk,
    fontSize: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  skip: { alignSelf: 'center', paddingVertical: space.sm },
  skipText: { color: colors.mutedInk, fontSize: 15 },
  options: { gap: space.md, marginBottom: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
  },
  emoji: { fontSize: 28 },
  optionLabel: { color: colors.primaryInk, fontSize: 17, fontWeight: '600' },
  areaHeader: { color: colors.secondaryInk, fontSize: 14, fontWeight: '600', marginTop: space.md },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  suggestionName: { color: colors.primaryInk, fontSize: 16 },
  footer: {
    padding: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.page,
  },
});
