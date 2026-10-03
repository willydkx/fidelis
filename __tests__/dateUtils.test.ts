import { Cadence } from '@/models/enums';
import { iterPeriods, monthEnd, monthStart, weekEnd, weekStart } from '@/utils/dateUtils';

test('week start and end', () => {
  const wednesday = '2026-01-07';
  expect(weekStart(wednesday)).toBe('2026-01-05');
  expect(weekEnd(wednesday)).toBe('2026-01-11');
});

test('month start and end', () => {
  const midMonth = '2026-02-15';
  expect(monthStart(midMonth)).toBe('2026-02-01');
  expect(monthEnd(midMonth)).toBe('2026-02-28');
});

test('iterPeriods daily', () => {
  expect(iterPeriods(Cadence.DAILY, '2026-01-01', '2026-01-03')).toEqual([
    ['2026-01-01', '2026-01-01'],
    ['2026-01-02', '2026-01-02'],
    ['2026-01-03', '2026-01-03'],
  ]);
});

test('iterPeriods weekly spans partial weeks', () => {
  const periods = iterPeriods(Cadence.WEEKLY, '2026-01-01', '2026-01-10');
  expect(periods[0]).toEqual(['2025-12-29', '2026-01-04']);
  expect(periods[periods.length - 1]).toEqual(['2026-01-05', '2026-01-11']);
});

test('iterPeriods monthly crosses year boundary', () => {
  expect(iterPeriods(Cadence.MONTHLY, '2025-12-01', '2026-01-31')).toEqual([
    ['2025-12-01', '2025-12-31'],
    ['2026-01-01', '2026-01-31'],
  ]);
});
