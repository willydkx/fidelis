import { Cadence, TrackingType } from '@/models/enums';
import { AREAS, MAX_PRESELECTED, suggestObjectives } from '@/onboarding/catalog';

const names = (s: ReturnType<typeof suggestObjectives>) => s.map((x) => x.objective.name);
const preselected = (s: ReturnType<typeof suggestObjectives>) => s.filter((x) => x.preselected).map((x) => x.key);

test('lists every objective of the chosen areas, in area order', () => {
  const s = suggestObjectives(['home', 'health'], 'gentle');
  expect(s.map((x) => x.area)).toEqual([
    'health',
    'health',
    'health',
    'health',
    'health',
    'home',
    'home',
    'home',
    'home',
  ]);
});

test('no areas → no suggestions', () => {
  expect(suggestObjectives([], 'gentle')).toEqual([]);
});

test('one area pre-ticks its starred objectives', () => {
  expect(preselected(suggestObjectives(['mind'], 'gentle'))).toEqual(['read', 'meditate']);
});

test('pre-ticks round-robin across areas, capped at MAX_PRESELECTED', () => {
  const s = suggestObjectives(['health', 'mind', 'digital', 'home'], 'gentle');
  expect(preselected(s)).toHaveLength(MAX_PRESELECTED);
  // First starred of each area, then the second of the first area.
  expect(new Set(preselected(s))).toEqual(new Set(['exercise', 'read', 'screen', 'tidy', 'walk']));
});

test('level changes the targets', () => {
  const gentle = suggestObjectives(['mind', 'health', 'digital'], 'gentle');
  const ambitious = suggestObjectives(['mind', 'health', 'digital'], 'ambitious');
  const byKey = (s: typeof gentle, key: string) => s.find((x) => x.key === key)!.objective;

  expect(byKey(gentle, 'read').targetValue).toBe(10);
  expect(byKey(ambitious, 'read').targetValue).toBe(30);
  expect(byKey(gentle, 'exercise')).toMatchObject({
    cadence: Cadence.WEEKLY,
    trackingType: TrackingType.BOOLEAN,
    targetValue: 2,
  });
  expect(byKey(ambitious, 'exercise').targetValue).toBe(4);
  expect(byKey(gentle, 'screen').name).toBe('Máximo 3 h de móvil');
  expect(byKey(ambitious, 'screen').name).toBe('Máximo 2 h de móvil');
  expect(byKey(gentle, 'stretch')).toMatchObject({ cadence: Cadence.CUSTOM_DAYS, daysOfWeek: [0, 2, 4] });
  expect(byKey(ambitious, 'stretch').cadence).toBe(Cadence.DAILY);
});

test('every suggestion is a valid objective with its area color', () => {
  for (const level of ['gentle', 'ambitious'] as const) {
    for (const { objective, area } of suggestObjectives(['health', 'mind', 'digital', 'home'], level)) {
      expect(objective.name.trim()).not.toBe('');
      expect(objective.color).toBe(AREAS.find((a) => a.id === area)!.color);
      if (objective.trackingType === TrackingType.NUMERIC) {
        expect(objective.targetValue).toBeGreaterThan(0);
        expect(objective.unit).toBeTruthy();
      }
      if (objective.cadence === Cadence.CUSTOM_DAYS) {
        expect(objective.daysOfWeek?.length).toBeGreaterThan(0);
      }
    }
  }
});

test('names are unique', () => {
  const all = names(suggestObjectives(['health', 'mind', 'digital', 'home'], 'gentle'));
  expect(new Set(all).size).toBe(all.length);
});
