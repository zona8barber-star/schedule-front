import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PushNotificationService, PushStatus } from '../../../../../core/services/push-notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { NotificationSettingsPageComponent } from './notification-settings-page.component';

/** SONDA BUG-109: «Activadas» only after the server confirmed; otherwise «No activadas» with «Reintentar». */
describe('NotificationSettingsPageComponent', () => {
  let fixture: ComponentFixture<NotificationSettingsPageComponent>;
  let status: ReturnType<typeof signal<PushStatus>>;
  let push: { status: typeof status; isEnabling: () => boolean; isSubscribed: () => boolean; enable: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  async function create(initial: PushStatus): Promise<HTMLElement> {
    status = signal<PushStatus>(initial);
    push = { status, isEnabling: () => false, isSubscribed: () => status() === 'enabled', enable: vi.fn(async () => null) };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NotificationSettingsPageComponent],
      providers: [
        { provide: PushNotificationService, useValue: push },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsPageComponent);
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
});
