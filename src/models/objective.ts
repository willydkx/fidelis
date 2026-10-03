import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { datePart, ISODate, weekday } from '@/utils/dateUtils';

export interface NewObjective {
  name: string;
  cadence: Cadence;
  trackingType: TrackingType;
  description?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  color?: string | null;
  sortOrder?: number;
  /** 0=Monday..6=Sunday; only for Cadence.CUSTOM_DAYS. */
  daysOfWeek?: number[] | null;
}

export interface Objective {
  id: number;
  name: string;
  cadence: Cadence;
  trackingType: TrackingType;
  status: ObjectiveStatus;
  /** SQLite timestamp, e.g. '2026-10-03 11:00:00'. */
  createdAt: string;
  description: string | null;
  targetValue: number | null;
  unit: string | null;
  color: string | null;
  sortOrder: number;
  archivedAt: string | null;
  daysOfWeek: number[] | null;
}

export function isApplicableOn(objective: Objective, day: ISODate): boolean {
  if (datePart(objective.createdAt) > day) {
    return false;
  }
  if (objective.archivedAt !== null && datePart(objective.archivedAt) <= day) {
    return false;
  }
  if (objective.cadence === Cadence.CUSTOM_DAYS) {
    return (objective.daysOfWeek ?? []).includes(weekday(day));
  }
  return true;
}
