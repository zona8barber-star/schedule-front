import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { App } from './app';

describe('App', () => {
  // jsdom implements neither matchMedia (queried by the shell and InstallPromptService on creation)
  // nor ResizeObserver (used by the shell once it renders).
  const originalMatchMedia = window.matchMedia;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };

    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        // The shell loads public content and wires push/update services; a disabled worker
        // provides SwPush/SwUpdate without registering anything.
        provideHttpClient(),
        provideHttpClientTesting(),
        provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the shell brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    // The brand is the logo image; without a configured branding, the static one.
    const brandLogo = compiled.querySelector<HTMLImageElement>('[data-testid="brand"] img');
    expect(brandLogo?.alt).toBe('Logo de Zona 8');
    expect(brandLogo?.getAttribute('src')).toBe('assets/images/logo_black.jpeg');
  });

  /** SONDA BUG-100: the name and logo configured in «Marca» replace the static ones in the header. */
  it('uses the configured branding name and logo in the header', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const httpMock = TestBed.inject(HttpTestingController);

    httpMock
      .match((request) => request.url.endsWith('/public/content/branding'))
      .forEach((request) =>
        request.flush({
          appName: 'Barbería Norte',
          primaryColor: '#111111',
          secondaryColor: '#222222',
          logoUrl: 'https://assets.example.com/logo-norte.png',
          appIconUrl: null,
        }),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const brandLogo = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('[data-testid="brand"] img');
    expect(brandLogo?.alt).toBe('Logo de Barbería Norte');
    expect(brandLogo?.getAttribute('src')).toBe('https://assets.example.com/logo-norte.png');
  });
});
