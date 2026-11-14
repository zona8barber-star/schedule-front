import { HttpErrorResponse } from '@angular/common/http';

import { isGuid, isNotFoundError } from './route-id.utils';

/** SONDA BUG-044: ids that cannot exist are not sent to the API. */
describe('route id utils', () => {
  it('accepts GUIDs only', () => {
    expect(isGuid('11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(isGuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isGuid('no-es-guid')).toBe(false);
    expect(isGuid('abc')).toBe(false);
    expect(isGuid(null)).toBe(false);
  });

  it('recognises a 404 answer', () => {
    expect(isNotFoundError(new HttpErrorResponse({ status: 404 }))).toBe(true);
    expect(isNotFoundError(new HttpErrorResponse({ status: 500 }))).toBe(false);
    expect(isNotFoundError(new Error('x'))).toBe(false);
  });
});
