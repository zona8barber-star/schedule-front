import { FormControl, FormGroup } from '@angular/forms';

import {
  absenceValidator,
  createDayRuleForm,
  createTimeBlockForm,
  formatDateTimeLocal,
  normalizeOptional,
  sortPeriods,
  toUtcIsoString,
} from './availability-form.utils';

describe('availability-form.utils', () => {
  it('createTimeBlockForm defaults to a 09:00-17:00 block', () => {
    const block = createTimeBlockForm();
    expect(block.getRawValue()).toEqual({ startTime: '09:00', endTime: '17:00' });
  });

  it('createDayRuleForm defaults to inactive with one time block', () => {
    const day = createDayRuleForm(2);
    expect(day.controls.dayOfWeek.value).toBe(2);
    expect(day.controls.isActive.value).toBe(false);
    expect(day.controls.blocks.length).toBe(1);
  });

  it('normalizeOptional trims and converts blank strings to null', () => {
    expect(normalizeOptional('  hola  ')).toBe('hola');
    expect(normalizeOptional('   ')).toBeNull();
    expect(normalizeOptional(null)).toBeNull();
    expect(normalizeOptional(undefined)).toBeNull();
  });

  it('toUtcIsoString converts a local datetime string to an ISO UTC string', () => {
    const result = toUtcIsoString('2026-09-01T10:00');
    expect(new Date(result).toISOString()).toBe(result);
  });

  it('formatDateTimeLocal round-trips through toUtcIsoString for the same wall-clock time', () => {
    const local = '2026-09-01T10:00';
    const utc = toUtcIsoString(local);
    expect(formatDateTimeLocal(utc)).toBe(local);
  });

  it('sortPeriods orders periods by startsAtUtc ascending without mutating the input', () => {
    const periods = [
      { id: 'b', startsAtUtc: '2026-09-02T00:00:00Z', endsAtUtc: '2026-09-02T01:00:00Z', reason: null, createdAtUtc: '2026-08-01T00:00:00Z' },
      { id: 'a', startsAtUtc: '2026-09-01T00:00:00Z', endsAtUtc: '2026-09-01T01:00:00Z', reason: null, createdAtUtc: '2026-08-01T00:00:00Z' },
    ];
    const sorted = sortPeriods(periods);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
    expect(periods.map((p) => p.id)).toEqual(['b', 'a']);
  });

  describe('absenceValidator', () => {
    // The validator compares against the browser's local "today"/"tomorrow". Pin the clock to a local
    // evening (21:30 on 2026-10-28): from 19:00 in Bogotá (UTC-5) the UTC date is already the next day,
    // which is exactly when building the expected dates from UTC used to break these tests.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 28, 21, 30));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function buildGroup(value: { isAllDay: boolean; startValue: string; endValue: string }) {
      return new FormGroup({
        isAllDay: new FormControl(value.isAllDay, { nonNullable: true }),
        startValue: new FormControl(value.startValue, { nonNullable: true }),
        endValue: new FormControl(value.endValue, { nonNullable: true }),
        reason: new FormControl('', { nonNullable: true }),
      });
    }

    it('returns null when start or end is empty', () => {
      const group = buildGroup({ isAllDay: false, startValue: '', endValue: '' });
      expect(absenceValidator()(group)).toBeNull();
    });

    it('flags an all-day range starting today or earlier as pastStart', () => {
      const today = buildGroup({ isAllDay: true, startValue: '2026-10-28', endValue: '2026-10-28' });
      expect(absenceValidator()(today)).toEqual({ pastStart: true });

      const yesterday = buildGroup({ isAllDay: true, startValue: '2026-10-27', endValue: '2026-10-28' });
      expect(absenceValidator()(yesterday)).toEqual({ pastStart: true });
    });

    it('accepts an all-day range starting tomorrow, even when the UTC date is already tomorrow', () => {
      const group = buildGroup({ isAllDay: true, startValue: '2026-10-29', endValue: '2026-10-29' });
      expect(absenceValidator()(group)).toBeNull();
    });

    it('flags an all-day range ending before it starts as timeRange', () => {
      const group = buildGroup({ isAllDay: true, startValue: '2026-09-05', endValue: '2026-09-01' });
      expect(absenceValidator()(group)?.['timeRange']).toBe(true);
    });

    it('accepts a valid future all-day range', () => {
      const group = buildGroup({ isAllDay: true, startValue: '2027-10-28', endValue: '2027-10-28' });
      expect(absenceValidator()(group)).toBeNull();
    });

    it('flags a timed range starting before tomorrow as pastStart', () => {
      // Local "now" and the last minute of today are both before tomorrow 00:00.
      const now = buildGroup({ isAllDay: false, startValue: '2026-10-28T21:30', endValue: '2026-10-28T21:30' });
      expect(absenceValidator()(now)?.['pastStart']).toBe(true);

      const lastMinute = buildGroup({ isAllDay: false, startValue: '2026-10-28T23:59', endValue: '2026-10-29T08:00' });
      expect(absenceValidator()(lastMinute)).toEqual({ pastStart: true });
    });

    it('accepts a timed range starting at tomorrow 00:00 local', () => {
      const group = buildGroup({ isAllDay: false, startValue: '2026-10-29T00:00', endValue: '2026-10-29T08:00' });
      expect(absenceValidator()(group)).toBeNull();
    });
  });
});
