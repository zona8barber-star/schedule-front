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
import { setDeviceTimeZone } from '../../testing/device-time-zone';

describe('availability-form.utils', () => {
  // SONDA BUG-030: the device is in UTC, the shop in Bogotá (UTC-5). Every value below is Bogotá time.
  let restoreTimeZone: () => void;
  beforeAll(() => (restoreTimeZone = setDeviceTimeZone('UTC')));
  afterAll(() => restoreTimeZone());

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

  it('toUtcIsoString reads the datetime-local value as Bogotá time, not device time (SONDA BUG-030)', () => {
    // A 09:00-10:00 absence entered on a UTC device must block 09:00-10:00 in Bogotá: 14:00Z-15:00Z.
    expect(toUtcIsoString('2026-11-25T09:00')).toBe('2026-11-25T14:00:00.000Z');
    expect(toUtcIsoString('2026-11-25T10:00')).toBe('2026-11-25T15:00:00.000Z');
  });

  it('formatDateTimeLocal shows the stored instant in Bogotá time and round-trips', () => {
    expect(formatDateTimeLocal('2026-11-25T14:00:00Z')).toBe('2026-11-25T09:00');
    const local = '2026-09-01T10:00';
    expect(formatDateTimeLocal(toUtcIsoString(local))).toBe(local);
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
    // The validator compares against Bogotá's "today"/"tomorrow". Pin the clock to 21:30 in Bogotá on
    // 2026-10-28 (02:30Z on the 29th): the UTC device already says the 29th, Bogotá still says the 28th.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-29T02:30:00Z'));
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
      // Bogotá "now" and the last minute of today are both before tomorrow 00:00.
      const now = buildGroup({ isAllDay: false, startValue: '2026-10-28T21:30', endValue: '2026-10-28T21:30' });
      expect(absenceValidator()(now)?.['pastStart']).toBe(true);

      const lastMinute = buildGroup({ isAllDay: false, startValue: '2026-10-28T23:59', endValue: '2026-10-29T08:00' });
      expect(absenceValidator()(lastMinute)).toEqual({ pastStart: true });
    });

    it('accepts a timed range starting at tomorrow 00:00 in Bogotá', () => {
      const group = buildGroup({ isAllDay: false, startValue: '2026-10-29T00:00', endValue: '2026-10-29T08:00' });
      expect(absenceValidator()(group)).toBeNull();
    });
  });
});
