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
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const group = buildGroup({ isAllDay: true, startValue: todayStr, endValue: todayStr });
      expect(absenceValidator()(group)).toEqual({ pastStart: true });
    });

    it('flags an all-day range ending before it starts as timeRange', () => {
      const group = buildGroup({ isAllDay: true, startValue: '2026-09-05', endValue: '2026-09-01' });
      expect(absenceValidator()(group)?.['timeRange']).toBe(true);
    });

    it('accepts a valid future all-day range', () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 1);
      const dateStr = farFuture.toISOString().slice(0, 10);
      const group = buildGroup({ isAllDay: true, startValue: dateStr, endValue: dateStr });
      expect(absenceValidator()(group)).toBeNull();
    });

    it('flags a timed range starting before tomorrow as pastStart', () => {
      const now = new Date().toISOString().slice(0, 16);
      const group = buildGroup({ isAllDay: false, startValue: now, endValue: now });
      expect(absenceValidator()(group)?.['pastStart']).toBe(true);
    });
  });
});
