import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PublicBrandingResponse } from '../models/content.models';
import { PublicContentApiService } from './public-content-api.service';
import { DEFAULT_APP_NAME, DEFAULT_LOGO_URL, PublicBrandingStore, brandTitleResolver } from './public-branding.store';

/** SONDA BUG-100: the configured name and logo, read once, with the static ones as fallback. */
describe('PublicBrandingStore', () => {
  const branding: PublicBrandingResponse = {
    appName: 'Barbería Norte',
    primaryColor: '#111111',
    secondaryColor: '#222222',
    logoUrl: 'https://assets.example.com/logo.png',
    appIconUrl: null,
  };

  function setup(getBranding: () => ReturnType<PublicContentApiService['getBranding']>) {
    const api = { getBranding: vi.fn(getBranding) };
    TestBed.configureTestingModule({ providers: [{ provide: PublicContentApiService, useValue: api }] });
    return { api, store: TestBed.inject(PublicBrandingStore) };
  }

  function resolveTitle(): Promise<string> {
    return TestBed.runInInjectionContext(
      () => brandTitleResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<string>,
    );
  }

  it('reads the branding once for everyone and exposes its name and logo', async () => {
    const { api, store } = setup(() => of(branding));

    await Promise.all([store.load(), store.load()]);

    expect(api.getBranding).toHaveBeenCalledTimes(1);
    expect(store.appName()).toBe('Barbería Norte');
    expect(store.logoUrl()).toBe('https://assets.example.com/logo.png');
    await expect(resolveTitle()).resolves.toBe('Barbería Norte');
  });

  it('falls back to the static name and logo when nothing is configured or the read fails', async () => {
    const { store } = setup(() => throwError(() => new Error('offline')));

    await expect(resolveTitle()).resolves.toBe(DEFAULT_APP_NAME);
    expect(store.appName()).toBe(DEFAULT_APP_NAME);
    expect(store.logoUrl()).toBe(DEFAULT_LOGO_URL);
  });
});
