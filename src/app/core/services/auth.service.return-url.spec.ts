import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { authGuard } from '../guards/auth.guard';
import { guestGuard } from '../guards/guest.guard';
import { roleGuard } from '../guards/role.guard';
import { LoginPageComponent } from '../../features/auth/pages/login-page/login-page.component';
import { AuthResponse } from '../models/auth.models';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

@Component({ template: '' })
class StubPageComponent {}

const customerSession: AuthResponse = {
  accessToken: 'access',
  expiresInSeconds: 3600,
  refreshToken: 'refresh',
  user: {
    id: 'u-1',
    fullName: 'Carla',
    email: 'carla@example.com',
    phoneNumber: null,
    roles: ['Customer'],
    profilePhotoId: null,
    profilePhotoUrl: null,
    permissions: [],
  },
};

const bookingUrl = '/booking/confirm?staffProfileId=st-1&startsAt=2026-11-20T15:00:00Z&generalServiceId=g-1';

/** SONDA BUG-064 (keep the query string) and BUG-011 (unsafe values go to the destination by role). */
describe('AuthService returnUrl after signing in', () => {
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    globalThis.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthApiService,
          useValue: {
            login: vi.fn(() => of(customerSession)),
            logout: vi.fn(() => of(undefined)),
            refresh: vi.fn(() => of(customerSession)),
          },
        },
        provideRouter([
          { path: '', component: StubPageComponent },
          { path: 'auth/login', component: LoginPageComponent, canActivate: [guestGuard] },
          { path: 'staff', component: StubPageComponent },
          {
            path: 'booking/confirm',
            component: StubPageComponent,
            canActivate: [authGuard, roleGuard],
            data: { roles: ['Customer'] },
          },
          { path: 'customer/appointments', component: StubPageComponent },
          { path: '**', component: StubPageComponent },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
  });

  async function signInFrom(loginUrl: string): Promise<string> {
    await router.navigateByUrl(loginUrl);
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.loginForm.setValue({ email: 'carla@example.com', password: 'secreta' });
    await fixture.componentInstance.submitLogin();
    return router.url;
  }

  it('comes back to the booking being confirmed, with its query string, after the guard sends to sign in', async () => {
    await router.navigateByUrl(bookingUrl);
    const loginTree = router.parseUrl(router.url);
    expect(loginTree.root.children['primary'].segments.map((segment) => segment.path)).toEqual(['auth', 'login']);
    expect(loginTree.queryParams['returnUrl']).toBe(bookingUrl);

    expect(await signInFrom(router.url)).toBe(bookingUrl);
  });

  it('keeps the query string of a public page too', async () => {
    expect(await signInFrom(`/auth/login?returnUrl=${encodeURIComponent('/staff?q=fade')}`)).toBe('/staff?q=fade');
  });

  it('sends someone already signed in who opens the sign-in link to the returnUrl, query string included', async () => {
    await auth.login({ email: 'carla@example.com', password: 'secreta' });

    await router.navigateByUrl(`/auth/login?returnUrl=${encodeURIComponent(bookingUrl)}`);

    expect(router.url).toBe(bookingUrl);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/auth/login',
    '/auth/login?returnUrl=%2Fstaff',
    '/%2F%2Fevil.example',
    '/%2Fevil.example',
    '/%5C%5Cevil.example',
    '/staff//evil',
    '/%2Fauth%2Flogin',
    '/%E0%A4%A',
  ])('sends an unsafe returnUrl (%s) to the destination by role', async (returnUrl) => {
    expect(await signInFrom(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`)).toBe('/customer/appointments');
  });

  it('accepts ordinary paths, including a trailing slash, an encoded space and a fragment', () => {
    auth.adoptSession(customerSession);
    expect(auth.resolvePostAuthUrl('/staff/')).toBe('/staff/');
    expect(auth.resolvePostAuthUrl('/staff?q=corte%20cl%C3%A1sico#top')).toBe('/staff?q=corte%20cl%C3%A1sico#top');
    expect(auth.resolvePostAuthUrl('/')).toBe('/');
  });
});
