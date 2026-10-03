import { Cadence } from '@/models/enums';

/** Calendar date as 'YYYY-MM-DD', the format stored in SQLite. */
export type ISODate = string;

export type Period = [start: ISODate, end: ISODate];

const DAY_MS = 86_400_000;

// All arithmetic is done on UTC midnights so DST changes never shift a date.
function toUtc(day: ISODate): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function makeDate(year: number, month: number, day: number): ISODate {
  return fromUtc(Date.UTC(year, month - 1, day));
}

export function today(): ISODate {
  const now = new Date();
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(day: ISODate, days: number): ISODate {
  return fromUtc(toUtc(day) + days * DAY_MS);
}

export function daysBetween(start: ISODate, end: ISODate): number {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS);
}

/** 0=Monday..6=Sunday, like Python's date.weekday(). */
export function weekday(day: ISODate): number {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

/** Date part of a SQLite timestamp ('YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DD'). */
export function datePart(timestamp: string): ISODate {
  return timestamp.slice(0, 10);
}

export function weekStart(day: ISODate): ISODate {
  return addDays(day, -weekday(day));
}

export function weekEnd(day: ISODate): ISODate {
  return addDays(weekStart(day), 6);
}

export function monthStart(day: ISODate): ISODate {
  return day.slice(0, 8) + '01';
}

export function monthEnd(day: ISODate): ISODate {
  const [y, m] = day.split('-').map(Number);
  return fromUtc(Date.UTC(y, m, 0));
}

/** (periodStart, periodEnd) tuples covering [start, end] for the given cadence. */
export function iterPeriods(cadence: Cadence, start: ISODate, end: ISODate): Period[] {
  const periods: Period[] = [];

  if (cadence === Cadence.DAILY || cadence === Cadence.CUSTOM_DAYS) {
    for (let day = start; day <= end; day = addDays(day, 1)) {
      periods.push([day, day]);
    }
  } else if (cadence === Cadence.WEEKLY) {
    for (let day = weekStart(start); day <= end; day = addDays(day, 7)) {
      periods.push([day, weekEnd(day)]);
    }
  } else {
    for (let day = monthStart(start); day <= end; day = addDays(monthEnd(day), 1)) {
      periods.push([day, monthEnd(day)]);
    }
  }

  return periods;
}

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** e.g. "sábado, 3 de octubre". */
export function formatLong(day: ISODate): string {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAY_NAMES[weekday(day)]}, ${d} de ${MONTH_NAMES[m - 1]}`;
}
