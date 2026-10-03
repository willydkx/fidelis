import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { NewObjective, Objective } from '@/models/objective';
import { CATEGORICAL } from '@/ui/theme';

/** Enough of an objective (saved or not yet created) to describe it. */
type Describable = Pick<NewObjective, 'cadence' | 'trackingType' | 'targetValue' | 'unit' | 'daysOfWeek'>;

export const WEEKDAY_ABBR = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const CADENCE_LABELS: Record<Cadence, string> = {
  [Cadence.DAILY]: 'Diaria',
  [Cadence.WEEKLY]: 'Semanal',
  [Cadence.MONTHLY]: 'Mensual',
  [Cadence.CUSTOM_DAYS]: 'Personalizada',
};

export const CADENCE_COLORS: Record<Cadence, string> = {
  [Cadence.DAILY]: CATEGORICAL[0],
  [Cadence.WEEKLY]: CATEGORICAL[1],
  [Cadence.MONTHLY]: CATEGORICAL[2],
  [Cadence.CUSTOM_DAYS]: CATEGORICAL[3],
};

export const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  [ObjectiveStatus.ACTIVE]: 'Activo',
  [ObjectiveStatus.PAUSED]: 'Pausado',
  [ObjectiveStatus.ARCHIVED]: 'Archivado',
};

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

export function cadenceText(objective: Describable): string {
  const label = CADENCE_LABELS[objective.cadence];
  if (objective.cadence === Cadence.CUSTOM_DAYS && objective.daysOfWeek?.length) {
    return `${label} (${objective.daysOfWeek.map((d) => WEEKDAY_ABBR[d]).join(',')})`;
  }
  return label;
}

export function targetText(objective: Describable): string | null {
  if (objective.targetValue == null) {
    return null;
  }
  if (objective.trackingType === TrackingType.BOOLEAN) {
    return `${formatNumber(objective.targetValue)} veces`;
  }
  return `${formatNumber(objective.targetValue)}${objective.unit ? ` ${objective.unit}` : ''}`;
}

export function objectiveColor(objective: Objective): string {
  return objective.color ?? CADENCE_COLORS[objective.cadence];
}
