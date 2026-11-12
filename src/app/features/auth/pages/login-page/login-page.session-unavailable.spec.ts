import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthStatus } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginPageComponent } from './login-page.component';

@Component({ template: '' })
class StubPageComponent {}

/** BUG-014: a stored session that could not be checked offers a retry instead of asking for the password. */
describe('LoginPageComponent with a stored session that could not be checked', () => {
  let status: ReturnType<typeof signal<AuthStatus>>;
  let auth: {
    status: typeof status;
    error: ReturnType<typeof signal<string | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    clearError: ReturnType<typeof vi.fn>;
    retryRestore: ReturnType<typeof vi.fn>;
    resolvePostAuthUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    status = signal<AuthStatus>('unavailable');
    auth = {
      status,
      error: signal<string | null>(null),
      isLoading: signal(false),
      clearError: vi.fn(),
      retryRestore: vi.fn(async () => {
        status.set('authenticated');
        return true;
      }),
      resolvePostAuthUrl: vi.fn(
        (returnUrl?: string | null) => returnUrl ?? '/customer/appointments',
      ),
    };

    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'auth/login', component: LoginPageComponent },
          { path: 'customer/profile', component: StubPageComponent },
          { path: 'customer/appointments', component: StubPageComponent },
        ]),
      ],
    });
  });

  async function render() {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/auth/login?returnUrl=%2Fcustomer%2Fprofile');
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, router, element: fixture.nativeElement as HTMLElement };
  }

  it('explains that the session is kept and offers a retry', async () => {
    const { element } = await render();

    const notice = element.querySelector('[data-testid="session-unavailable"]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('Tu sesión sigue guardada');
    expect(element.querySelector('[data-testid="session-retry"]')).not.toBeNull();
  });

  it('continues to the requested page once the retry restores the session', async () => {
    const { fixture, router, element } = await render();

    element.querySelector<HTMLButtonElement>('[data-testid="session-retry"]')!.click();
    await vi.waitFor(() => expect(router.url).toBe('/customer/profile'));

    expect(auth.retryRestore).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('does not show the notice for a visitor without a stored session', async () => {
    status.set('anonymous');
    const { element } = await render();

    expect(element.querySelector('[data-testid="session-unavailable"]')).toBeNull();
  });
});
