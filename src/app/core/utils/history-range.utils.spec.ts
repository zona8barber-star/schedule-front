import {
  HISTORY_MAX_DAYS,
  defaultHistoryRange,
  historyRangeDays,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
  resolveOptionalRange,
} from './history-range.utils';

describe('history range utils', () => {
  it('defaults a history to the last 30 days ending today, both ends included', () => {
    const range = defaultHistoryRange('2026-11-07');

    expect(range).toEqual({ from: '2026-10-09', to: '2026-11-07' });
    expect(historyRangeDays(range.from, range.to)).toBe(HISTORY_MAX_DAYS);
  });

  it('accepts 30 days at any period and rejects 31 or a reversed range', () => {
    expect(historyRangeError('2026-10-09', '2026-11-07')).toBeNull();
    expect(historyRangeError('2024-02-01', '2024-03-01')).toBeNull();
    expect(historyRangeError('2026-10-08', '2026-11-07')).toContain('30 días');
    expect(historyRangeError('2026-11-07', '2026-11-06')).toContain('posterior');
  });

  it('completes a missing end like the API does, and leaves queues without a window', () => {
    expect(resolveHistoryRange('', '', '2026-11-07')).toEqual({ from: '2026-10-09', to: '2026-11-07' });
    expect(resolveHistoryRange('2025-01-01', '')).toEqual({ from: '2025-01-01', to: '2025-01-30' });
    expect(resolveHistoryRange('', '2025-01-30')).toEqual({ from: '2025-01-01', to: '2025-01-30' });
    expect(resolveOptionalRange('', '')).toBeNull();
    expect(resolveOptionalRange('2025-01-01', '')).toEqual({ from: '2025-01-01', to: '2025-01-30' });
  });

  it('keeps an edited range valid by moving the other end only when needed', () => {
    const current = { from: '2026-10-09', to: '2026-11-07' };

    expect(rangeWithFrom('2026-10-20', current)).toEqual({ from: '2026-10-20', to: '2026-11-07' });
    expect(rangeWithFrom('2026-01-01', current)).toEqual({ from: '2026-01-01', to: '2026-01-30' });
    expect(rangeWithFrom('2026-11-01', current, '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-05' });
    expect(rangeWithTo('2026-11-01', current)).toEqual({ from: '2026-10-09', to: '2026-11-01' });
    expect(rangeWithTo('2026-03-15', current)).toEqual({ from: '2026-02-14', to: '2026-03-15' });
  });
});
