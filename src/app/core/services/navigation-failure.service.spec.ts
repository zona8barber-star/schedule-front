import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { NavigationFailureService, isModuleLoadError } from './navigation-failure.service';

@Injectable()
class TestNavigationFailureService extends NavigationFailureService {
  readonly reloads: string[] = [];

  protected override reloadPage(url: string): void {
    this.reloads.push(url);
  }
}

/** SONDA BUG-065: a page that could not be opened shows «Sin conexión» with «Reintentar», never a blank screen. */
describe('NavigationFailureService', () => {
  let events: Subject<unknown>;
  let router: { events: Subject<unknown>; navigateByUrl: ReturnType<typeof vi.fn> };
  let service: TestNavigationFailureService;

  const chunkError = new TypeError(
    'Failed to fetch dynamically imported module: https://app.test/chunk-ABC.js',
  );

  beforeEach(() => {
    events = new Subject();
    router = { events, navigateByUrl: vi.fn(async () => true) };
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }, TestNavigationFailureService],
    });
    service = TestBed.inject(TestNavigationFailureService);
  });

  it('keeps the failed page so the shell can offer «Reintentar»', () => {
    service.report(new NavigationError(1, '/auth/login', chunkError));

    expect(service.failure()).toEqual({ url: '/auth/login', error: chunkError });
  });

  it('forgets the failure once a navigation succeeds', () => {
    service.report(new NavigationError(1, '/auth/login', chunkError));
    events.next(new NavigationEnd(2, '/', '/'));

    expect(service.failure()).toBeNull();
  });

  it('opens a page whose code did not download with a full load (the browser would fail the same import again)', async () => {
    service.report(new NavigationError(1, '/customer/appointments', chunkError));

    await service.retry();

    expect(service.reloads).toEqual(['/customer/appointments']);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('retries other failures through the router', async () => {
    service.report(new NavigationError(1, '/staff', new Error('resolver failed')));

    await service.retry();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/staff');
  });

  it('retries by itself when the network comes back', async () => {
    service.report(new NavigationError(1, '/booking', chunkError));

    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(service.reloads).toEqual(['/booking']));
  });

  it('recognises the module load errors of Chrome, Safari and Firefox', () => {
    expect(isModuleLoadError(chunkError)).toBe(true);
    expect(isModuleLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isModuleLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isModuleLoadError(new Error('Cannot match any routes'))).toBe(false);
  });
});
