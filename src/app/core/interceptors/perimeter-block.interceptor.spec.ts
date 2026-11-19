import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { getApiErrorMessage } from '../utils/api-error.utils';
import { PERIMETER_BLOCK_MESSAGE, perimeterBlockInterceptor } from './perimeter-block.interceptor';

// SONDA BUG-139 / BUG-154: the security filter's «Blocked» page must read as a rejected text, not as «sin conexión».
describe('perimeterBlockInterceptor', () => {
  const api = environment.defaultApiBaseUrl;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([perimeterBlockInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function failWith(status: number, body: unknown, healthOk: boolean | null): Promise<unknown> {
    const request = firstValueFrom(http.post(`${api}/admin/inventory/p-1/adjustments`, { reason: "'; DROP TABLE--" })).catch((error: unknown) => error);
    const call = httpMock.expectOne(`${api}/admin/inventory/p-1/adjustments`);
    if (status === 0) {
      call.error(new ProgressEvent('error'), { status: 0 });
    } else {
      call.flush(body as string | object | null, { status, statusText: 'x' });
    }
    await Promise.resolve();
    if (healthOk !== null) {
      const health = httpMock.expectOne(`${api}/health`);
      if (healthOk) {
        health.flush({ status: 'ok' });
      } else {
        health.error(new ProgressEvent('error'), { status: 0 });
      }
    }

    return request;
  }

  it('turns a blocked request the browser shows as status 0 into a rejected text when the API is reachable', async () => {
    const error = (await failWith(0, null, true)) as HttpErrorResponse;

    expect(error.status).toBe(403);
    expect(getApiErrorMessage(error)).toBe(PERIMETER_BLOCK_MESSAGE);
  });

  it('keeps «sin conexión» when the API cannot be reached either', async () => {
    const error = (await failWith(0, null, false)) as HttpErrorResponse;

    expect(error.status).toBe(0);
  });

  it('recognizes the HTML block page itself', async () => {
    const error = (await failWith(403, '<!DOCTYPE html><title>Attention Required! | Cloudflare</title> Sorry, you have been blocked', null)) as HttpErrorResponse;

    expect(getApiErrorMessage(error)).toBe(PERIMETER_BLOCK_MESSAGE);
  });

  it('leaves the API own 403 untouched', async () => {
    const error = (await failWith(403, { title: 'Prohibido', detail: 'No tienes permiso para hacer esto.' }, null)) as HttpErrorResponse;

    expect(getApiErrorMessage(error)).toBe('No tienes permiso para hacer esto.');
  });
});
