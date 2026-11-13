import { HttpErrorResponse } from '@angular/common/http';

import { CONNECTIVITY_ERROR_MESSAGE, getApiErrorMessage, isConnectivityError } from './api-error.utils';

/** SONDA BUG-045: the service worker answers 504 without network; that is not "not found" nor a generic failure. */
describe('isConnectivityError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('treats a request that never left the device (status 0) as no network', () => {
    expect(isConnectivityError(new HttpErrorResponse({ status: 0 }))).toBe(true);
  });

  it('treats the service worker 504 as no network only while the device is offline', () => {
    const gatewayTimeout = new HttpErrorResponse({ status: 504, statusText: 'Gateway Timeout' });

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isConnectivityError(gatewayTimeout)).toBe(true);
    expect(getApiErrorMessage(gatewayTimeout)).toBe(CONNECTIVITY_ERROR_MESSAGE);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(isConnectivityError(gatewayTimeout)).toBe(false);
  });

  it('does not take server answers or other errors for missing network', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    expect(isConnectivityError(new HttpErrorResponse({ status: 404 }))).toBe(false);
    expect(isConnectivityError(new Error('boom'))).toBe(false);
    expect(isConnectivityError(null)).toBe(false);
  });
});
