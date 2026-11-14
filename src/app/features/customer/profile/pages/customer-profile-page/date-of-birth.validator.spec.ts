import { FormControl } from '@angular/forms';

import { dateOfBirthValidator } from './customer-profile-page.component';

/** SONDA BUG-059: the birth date accepts 1900-01-01 to today (Bogotá), like the API; empty stays optional. */
describe('dateOfBirthValidator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2026-11-14T03:00Z is still 2026-11-13 in Bogotá.
    vi.setSystemTime(new Date('2026-11-14T03:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it.each(['', '1900-01-01', '1990-05-20', '2026-11-13'])('accepts %s', (value) => {
    expect(dateOfBirthValidator()(new FormControl(value))).toBeNull();
  });

  it.each(['1899-12-31', '0001-01-01', '2026-11-14', '2030-01-01'])('rejects %s', (value) => {
    expect(dateOfBirthValidator()(new FormControl(value))).toEqual({ dateRange: true });
  });
});
