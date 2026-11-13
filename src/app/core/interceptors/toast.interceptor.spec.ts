import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { ToastService } from '../services/toast.service';
import { CONNECTIVITY_ERROR_MESSAGE } from '../utils/api-error.utils';
import { toastInterceptor } from './toast.interceptor';

const api = 'http://api.test/api/v1';

/** SONDA BUG-032: a failed request for a professional's services is not "the appointments could not load". */
describe('toastInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([toastInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: RuntimeConfigService, useValue: { config: signal({ apiBaseUrl: api }) } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  async function failGet(path: string, status = 404): Promise<void> {
    const request = firstValueFrom(http.get(`${api}${path}`)).catch(() => undefined);
    backend.expectOne(`${api}${path}`).flush({ detail: 'The staff profile was not found.' }, { status, statusText: 'Error' });
    await request;
  }

  it('shows no toast when the services of a professional cannot be loaded (the form explains it)', async () => {
    await failGet('/admin/appointments/service-options?staffProfileId=st-1');
    await failGet('/staff/appointments/service-options', 500);

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('still reports when the appointments themselves cannot be loaded', async () => {
    await failGet('/admin/appointments?page=1', 500);

    expect(toast.error).toHaveBeenCalledWith('No pudimos cargar las citas por ahora.');
  });

  it('leaves a booking conflict to the booking page, which checks whether it is the customer own one (BUG-043)', async () => {
    const request = firstValueFrom(http.post(`${api}/customer/appointments`, {})).catch(() => undefined);
    backend.expectOne(`${api}/customer/appointments`).flush({}, { status: 409, statusText: 'Conflict' });
    await request;

    expect(toast.error).not.toHaveBeenCalled();
  });

  // SONDA BUG-066 / BUG-045: without network every call fails; they all share one text so a single toast remains.
  it('collapses every request that failed for lack of network into one connection notice', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await failGet('/public/content/landing', 504);
    await failGet('/public/staff', 504);
    await failGet('/public/staff/st-1/availability/slots?date=2026-11-13', 504);
    const request = firstValueFrom(http.get(`${api}/public/staff/st-1/reviews`)).catch(() => undefined);
    backend.expectOne(`${api}/public/staff/st-1/reviews`).error(new ProgressEvent('error'));
    await request;

    const messages = new Set(toast.error.mock.calls.map(([message]) => message));
    expect([...messages]).toEqual([CONNECTIVITY_ERROR_MESSAGE]);
  });

  it('keeps the specific message when the server answered (with network)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await failGet('/public/staff', 504);

    expect(toast.error).toHaveBeenCalledWith('No pudimos cargar los perfiles de profesionales por ahora.');
  });
});
