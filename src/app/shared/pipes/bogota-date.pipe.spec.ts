import { DatePipe } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { setDeviceTimeZone } from '../../testing/device-time-zone';
import { BogotaDatePipe } from './bogota-date.pipe';

/** Pending from SONDA lote B: instants are shown in Bogotá time whatever the device's timezone. */
describe('BogotaDatePipe', () => {
  let restore: () => void;
  beforeAll(() => (restore = setDeviceTimeZone('Asia/Tokyo')));
  afterAll(() => restore());

  function pipe(): BogotaDatePipe {
    return TestBed.runInInjectionContext(() => new BogotaDatePipe());
  }

  it('shows an instant in Bogotá time, not the device time', () => {
    // 03:30 UTC on the 13th is 22:30 on the 12th in Bogotá and 12:30 on the 13th in Tokyo.
    const instant = '2026-11-13T03:30:00Z';

    expect(pipe().transform(instant, 'yyyy-MM-dd HH:mm')).toBe('2026-11-12 22:30');
    expect(new DatePipe('en-US').transform(instant, 'yyyy-MM-dd HH:mm')).toBe('2026-11-13 12:30');
  });

  it('defaults to mediumDate and returns null for an empty value', () => {
    expect(pipe().transform('2026-11-13T03:30:00Z')).toBe('Nov 12, 2026');
    expect(pipe().transform(null)).toBeNull();
    expect(pipe().transform('')).toBeNull();
  });
});
