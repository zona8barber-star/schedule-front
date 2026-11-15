import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { NotificationPreferencesResponse } from '../../../../../core/models/notification.models';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';

import { PushNotificationService, PushStatus } from '../../../../../core/services/push-notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { NotificationSettingsPageComponent } from './notification-settings-page.component';

/** SONDA BUG-109: «Activadas» only after the server confirmed; otherwise «No activadas» with «Reintentar». */
describe('NotificationSettingsPageComponent', () => {
  let fixture: ComponentFixture<NotificationSettingsPageComponent>;
  let status: ReturnType<typeof signal<PushStatus>>;
  let push: { status: typeof status; isEnabling: () => boolean; isSubscribed: () => boolean; enable: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let api: { getPreferences: ReturnType<typeof vi.fn>; updatePreferences: ReturnType<typeof vi.fn> };

  const allOn: NotificationPreferencesResponse = {
    categories: [
      { category: 'appointments', pushEnabled: true },
      { category: 'memberships', pushEnabled: true },
      { category: 'loyalty', pushEnabled: true },
      { category: 'purchases', pushEnabled: true },
      { category: 'campaigns', pushEnabled: true },
    ],
  };

  async function create(initial: PushStatus): Promise<HTMLElement> {
    status = signal<PushStatus>(initial);
    push = { status, isEnabling: () => false, isSubscribed: () => status() === 'enabled', enable: vi.fn(async () => null) };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    api = {
      getPreferences: vi.fn(() => of(allOn)),
      updatePreferences: vi.fn(() =>
        of({ categories: allOn.categories.map((item) => (item.category === 'campaigns' ? { ...item, pushEnabled: false } : item)) }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationSettingsPageComponent],
      providers: [
        provideRouter([]),
        { provide: PushNotificationService, useValue: push },
        { provide: ToastService, useValue: toast },
        { provide: NotificationsApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a rejected registration as not activated and offers «Reintentar»', async () => {
    const element = await create('unconfirmed');

    expect(element.querySelector('[data-testid="push-status"]')!.textContent).toContain('No activadas');
    const retry = element.querySelector<HTMLButtonElement>('[data-testid="push-retry"]');
    expect(retry?.textContent).toContain('Reintentar');

    retry!.click();
    await fixture.whenStable();
    expect(push.enable).toHaveBeenCalled();
  });

  it('does not claim «Activadas» while the server is still confirming', async () => {
    const element = await create('checking');

    expect(element.querySelector('[data-testid="push-status"]')!.textContent).toContain('Comprobando');
    expect(element.textContent).not.toContain('Activadas en este dispositivo');
  });

  it('does not celebrate when the retry fails', async () => {
    await create('unconfirmed');
    push.enable.mockResolvedValue('No se pudo registrar este dispositivo en el servidor.');

    await fixture.componentInstance.enable();

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  // ADR-0019 N4 (SONDA BUG-116): push preferences per type of notice.
  it('shows the five types switched on by default and links to the history', async () => {
    const element = await create('enabled');

    for (const category of ['appointments', 'memberships', 'loyalty', 'purchases', 'campaigns']) {
      const toggle = element.querySelector<HTMLInputElement>(`[data-testid="pref-${category}"]`);
      expect(toggle?.checked).toBe(true);
      expect(toggle?.getAttribute('role')).toBe('switch');
    }

    expect(element.textContent).toContain('Los avisos de tu cuenta y de seguridad siempre te llegan.');
    expect(element.querySelector('[data-testid="notification-history-link"]')?.getAttribute('href')).toBe(
      '/account/notifications/history',
    );
  });

  it('saves a switched-off type right away', async () => {
    const element = await create('enabled');
    const toggle = element.querySelector<HTMLInputElement>('[data-testid="pref-campaigns"]')!;

    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.updatePreferences).toHaveBeenCalledWith({ categories: [{ category: 'campaigns', pushEnabled: false }] });
    expect(element.querySelector<HTMLInputElement>('[data-testid="pref-campaigns"]')!.checked).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Ya no recibirás avisos push de campañas');
  });

  it('puts the switch back when saving fails', async () => {
    const element = await create('enabled');
    api.updatePreferences.mockReturnValue(throwError(() => new Error('offline')));

    element.querySelector<HTMLInputElement>('[data-testid="pref-loyalty"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector<HTMLInputElement>('[data-testid="pref-loyalty"]')!.checked).toBe(true);
    expect(toast.error).toHaveBeenCalled();
  });
});
