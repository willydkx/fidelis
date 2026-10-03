import { Cadence, TrackingType } from '@/models/enums';
import { NewObjective } from '@/models/objective';

export type AreaId = 'health' | 'mind' | 'digital' | 'home';
export type Level = 'gentle' | 'ambitious';

export interface Area {
  id: AreaId;
  emoji: string;
  label: string;
  description: string;
  color: string;
}

export const AREAS: Area[] = [
  {
    id: 'health',
    emoji: '💪',
    label: 'Ejercicio y salud',
    description: 'Moverte, beber agua, dormir mejor',
    color: '#199e70',
  },
  {
    id: 'mind',
    emoji: '🧠',
    label: 'Mente y aprendizaje',
    description: 'Leer, estudiar, meditar, idiomas',
    color: '#9085e9',
  },
  {
    id: 'digital',
    emoji: '📱',
    label: 'Vida digital y finanzas',
    description: 'Menos pantalla, controlar gastos, ahorrar',
    color: '#3987e5',
  },
  { id: 'home', emoji: '🏠', label: 'Hogar y social', description: 'Orden, cocinar, tu gente', color: '#c98500' },
];

export const MAX_PRESELECTED = 5;

interface CatalogItem {
  key: string;
  area: AreaId;
  /** Pre-ticked in the suggestions list (subject to MAX_PRESELECTED). */
  starred: boolean;
  build: (level: Level) => Omit<NewObjective, 'color' | 'sortOrder'>;
}

const pick = <T>(level: Level, gentle: T, ambitious: T): T => (level === 'gentle' ? gentle : ambitious);

const numeric = (name: string, cadence: Cadence, target: number, unit: string, daysOfWeek: number[] | null = null) => ({
  name,
  cadence,
  trackingType: TrackingType.NUMERIC,
  targetValue: target,
  unit,
  daysOfWeek,
});

const yesNo = (
  name: string,
  cadence: Cadence = Cadence.DAILY,
  times: number | null = null,
  daysOfWeek: number[] | null = null,
) => ({
  name,
  cadence,
  trackingType: TrackingType.BOOLEAN,
  targetValue: times,
  daysOfWeek,
});

const WEEKDAYS = [0, 1, 2, 3, 4];

const CATALOG: CatalogItem[] = [
  // Ejercicio y salud
  {
    key: 'exercise',
    area: 'health',
    starred: true,
    build: (l) => yesNo('Hacer ejercicio', Cadence.WEEKLY, pick(l, 2, 4)),
  },
  {
    key: 'walk',
    area: 'health',
    starred: true,
    build: (l) => numeric('Caminar', Cadence.DAILY, pick(l, 20, 45), 'minutos'),
  },
  {
    key: 'water',
    area: 'health',
    starred: false,
    build: (l) => numeric('Beber agua', Cadence.DAILY, pick(l, 6, 8), 'vasos'),
  },
  {
    key: 'sleep',
    area: 'health',
    starred: false,
    build: (l) => yesNo(`Dormir antes de las ${pick(l, '23:30', '23:00')}`),
  },
  {
    key: 'stretch',
    area: 'health',
    starred: false,
    build: (l) => (l === 'gentle' ? yesNo('Estirar', Cadence.CUSTOM_DAYS, null, [0, 2, 4]) : yesNo('Estirar')),
  },
  // Mente y aprendizaje
  {
    key: 'read',
    area: 'mind',
    starred: true,
    build: (l) => numeric('Leer', Cadence.DAILY, pick(l, 10, 30), 'páginas'),
  },
  {
    key: 'meditate',
    area: 'mind',
    starred: true,
    build: (l) => numeric('Meditar', Cadence.DAILY, pick(l, 5, 15), 'minutos'),
  },
  {
    key: 'study',
    area: 'mind',
    starred: false,
    build: (l) => numeric('Estudiar', Cadence.CUSTOM_DAYS, pick(l, 30, 60), 'minutos', WEEKDAYS),
  },
  {
    key: 'language',
    area: 'mind',
    starred: false,
    build: (l) => numeric('Practicar un idioma', Cadence.DAILY, pick(l, 10, 20), 'minutos'),
  },
  { key: 'journal', area: 'mind', starred: false, build: () => yesNo('Escribir un diario') },
  // Vida digital y finanzas
  { key: 'screen', area: 'digital', starred: true, build: (l) => yesNo(`Máximo ${pick(l, 3, 2)} h de móvil`) },
  { key: 'expenses', area: 'digital', starred: true, build: () => yesNo('Apuntar los gastos del día') },
  { key: 'nophone', area: 'digital', starred: false, build: () => yesNo('Sin móvil la última hora antes de dormir') },
  {
    key: 'save',
    area: 'digital',
    starred: false,
    build: (l) => numeric('Ahorrar', Cadence.MONTHLY, pick(l, 50, 200), '€'),
  },
  // Hogar y social
  {
    key: 'tidy',
    area: 'home',
    starred: true,
    build: (l) => numeric('Ordenar', Cadence.DAILY, pick(l, 10, 20), 'minutos'),
  },
  { key: 'cook', area: 'home', starred: true, build: (l) => yesNo('Cocinar en casa', Cadence.WEEKLY, pick(l, 3, 5)) },
  {
    key: 'call',
    area: 'home',
    starred: false,
    build: (l) => yesNo('Llamar a familia o amigos', Cadence.WEEKLY, pick(l, 1, 3)),
  },
  { key: 'clean', area: 'home', starred: false, build: (l) => yesNo('Limpiar la casa', Cadence.WEEKLY, pick(l, 1, 2)) },
];

export interface Suggestion {
  key: string;
  area: AreaId;
  objective: NewObjective;
  preselected: boolean;
}

/**
 * Every catalog objective of the chosen areas (in area order), sized for the level. Starred
 * ones are pre-ticked round-robin across areas so each area gets a fair share of the
 * MAX_PRESELECTED slots.
 */
export function suggestObjectives(areaIds: AreaId[], level: Level): Suggestion[] {
  const chosen = AREAS.filter((a) => areaIds.includes(a.id));

  const preselected = new Set<string>();
  const starredByArea = chosen.map((a) => CATALOG.filter((i) => i.area === a.id && i.starred));
  for (let round = 0; preselected.size < MAX_PRESELECTED; round++) {
    const picks = starredByArea.map((items) => items[round]).filter(Boolean);
    if (!picks.length) break;
    for (const item of picks) {
      if (preselected.size < MAX_PRESELECTED) preselected.add(item.key);
    }
  }

  return chosen.flatMap((area) =>
    CATALOG.filter((i) => i.area === area.id).map((item) => ({
      key: item.key,
      area: item.area,
      objective: { ...item.build(level), color: area.color },
      preselected: preselected.has(item.key),
    })),
  );
}
