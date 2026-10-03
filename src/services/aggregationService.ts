import { EFFICIENCY_COMPLETION_WEIGHT, EFFICIENCY_RATIO_WEIGHT } from '@/config';
import { Cadence, ObjectiveStatus, TrackingType } from '@/models/enums';
import { isApplicableOn, Objective } from '@/models/objective';
import { EntriesRepository } from '@/repositories/entriesRepository';
import { ObjectivesRepository } from '@/repositories/objectivesRepository';
import { addDays, datePart, ISODate, iterPeriods, makeDate, today, weekday } from '@/utils/dateUtils';

export interface PeriodStat {
  periodStart: ISODate;
  periodEnd: ISODate;
  objectiveId: number;
  ratio: number;
  completed: boolean;
}

/** Streaks, completion ratios and the efficiency score, all derived from logged entries. */
export class AggregationService {
  constructor(
    private readonly objectivesRepo: ObjectivesRepository,
    private readonly entriesRepo: EntriesRepository,
  ) {}

  async periodStats(objective: Objective, start: ISODate, end: ISODate): Promise<PeriodStat[]> {
    if (end < start) {
      return [];
    }
    const entries = await this.entriesRepo.getEntriesInRange(start, end, objective.id);
    const target = objective.targetValue ? objective.targetValue : 1.0;

    let periods = iterPeriods(objective.cadence, start, end);
    if (objective.cadence === Cadence.CUSTOM_DAYS) {
      const daysOfWeek = new Set(objective.daysOfWeek ?? []);
      periods = periods.filter(([periodStart]) => daysOfWeek.has(weekday(periodStart)));
    }

    return periods.map(([periodStart, periodEnd]) => {
      const periodEntries = entries.filter((e) => periodStart <= e.entryDate && e.entryDate <= periodEnd);
      const periodValue =
        objective.trackingType === TrackingType.NUMERIC
          ? periodEntries.reduce((sum, e) => sum + (e.value ?? 0), 0)
          : periodEntries.filter((e) => e.completed).length;
      const ratio = periodValue / target;
      return { periodStart, periodEnd, objectiveId: objective.id, ratio, completed: ratio >= 1.0 };
    });
  }

  async currentStreak(objective: Objective, asOf: ISODate = today()): Promise<number> {
    const stats = await this.periodStats(objective, datePart(objective.createdAt), asOf);
    let streak = 0;
    for (let i = stats.length - 1; i >= 0; i--) {
      if (!stats[i].completed) {
        break;
      }
      streak++;
    }
    return streak;
  }

  async longestStreak(objective: Objective, asOf: ISODate = today()): Promise<number> {
    const stats = await this.periodStats(objective, datePart(objective.createdAt), asOf);
    let longest = 0;
    let current = 0;
    for (const stat of stats) {
      if (stat.completed) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    return longest;
  }

  /** Share of applicable active objectives completed on `day`; `cadence: null` means all cadences. */
  async dailyCompletionRate(day: ISODate, cadence: Cadence | null = Cadence.DAILY): Promise<number> {
    const objectives = (await this.objectivesRepo.list(ObjectiveStatus.ACTIVE)).filter(
      (o) => isApplicableOn(o, day) && (cadence === null || o.cadence === cadence),
    );
    if (!objectives.length) {
      return 0.0;
    }
    const completedIds = new Set(
      (await this.entriesRepo.getEntriesForDate(day)).filter((e) => e.completed).map((e) => e.objectiveId),
    );
    return objectives.filter((o) => completedIds.has(o.id)).length / objectives.length;
  }

  /**
   * dailyCompletionRate(day, null) for every day in [start, end], using two queries total
   * instead of two per day.
   */
  async completionRatesInRange(start: ISODate, end: ISODate): Promise<Map<ISODate, number>> {
    const objectives = await this.objectivesRepo.list(ObjectiveStatus.ACTIVE);
    const completedByDay = new Map<ISODate, Set<number>>();
    for (const entry of await this.entriesRepo.getEntriesInRange(start, end)) {
      if (!entry.completed) continue;
      if (!completedByDay.has(entry.entryDate)) completedByDay.set(entry.entryDate, new Set());
      completedByDay.get(entry.entryDate)!.add(entry.objectiveId);
    }

    const rates = new Map<ISODate, number>();
    for (let day = start; day <= end; day = addDays(day, 1)) {
      const applicable = objectives.filter((o) => isApplicableOn(o, day));
      const completedIds = completedByDay.get(day) ?? new Set<number>();
      rates.set(
        day,
        applicable.length ? applicable.filter((o) => completedIds.has(o.id)).length / applicable.length : 0.0,
      );
    }
    return rates;
  }

  /** Start of the cadence-appropriate lookback window, clamped to the objective's creation date. */
  lookbackWindow(objective: Objective, asOf: ISODate): ISODate {
    let start: ISODate;
    if (objective.cadence === Cadence.DAILY || objective.cadence === Cadence.CUSTOM_DAYS) {
      start = addDays(asOf, -29);
    } else if (objective.cadence === Cadence.WEEKLY) {
      start = addDays(asOf, -8 * 7);
    } else {
      start = addDays(asOf, -30 * 6);
    }
    const created = datePart(objective.createdAt);
    return start > created ? start : created;
  }

  async averageCompletionRatio(objective: Objective, asOf: ISODate = today()): Promise<number> {
    const stats = await this.periodStats(objective, this.lookbackWindow(objective, asOf), asOf);
    if (!stats.length) {
      return 0.0;
    }
    return stats.reduce((sum, s) => sum + Math.min(s.ratio, 1.0), 0) / stats.length;
  }

  heatmapData(year: number): Promise<Map<ISODate, number>> {
    return this.completionRatesInRange(makeDate(year, 1, 1), makeDate(year, 12, 31));
  }

  async efficiencyScore(asOf: ISODate = today()): Promise<number> {
    const objectives = await this.objectivesRepo.list(ObjectiveStatus.ACTIVE);
    const scores: number[] = [];
    for (const objective of objectives) {
      const stats = await this.periodStats(objective, this.lookbackWindow(objective, asOf), asOf);
      if (!stats.length) {
        continue;
      }
      const avgRatio = stats.reduce((sum, s) => sum + Math.min(s.ratio, 1.0), 0) / stats.length;
      const fullyMetFrac = stats.filter((s) => s.completed).length / stats.length;
      scores.push(EFFICIENCY_RATIO_WEIGHT * avgRatio + EFFICIENCY_COMPLETION_WEIGHT * fullyMetFrac);
    }
    if (!scores.length) {
      return 0.0;
    }
    return 100 * (scores.reduce((a, b) => a + b, 0) / scores.length);
  }
}
