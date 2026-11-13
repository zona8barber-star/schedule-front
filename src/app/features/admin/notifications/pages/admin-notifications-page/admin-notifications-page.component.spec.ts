import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotificationCampaignResponse } from '../../../../../core/models/notification.models';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { AdminNotificationsPageComponent } from './admin-notifications-page.component';

/** SONDA BUG-110: no audience preselected and a confirmation with the recipient count before sending. */
describe('AdminNotificationsPageComponent', () => {
  let fixture: ComponentFixture<AdminNotificationsPageComponent>;
  let component: AdminNotificationsPageComponent;
  let api: {
    getCampaigns: ReturnType<typeof vi.fn>;
    previewBroadcast: ReturnType<typeof vi.fn>;
    broadcast: ReturnType<typeof vi.fn>;
    searchCustomers: ReturnType<typeof vi.fn>;
  };
  let confirm: ReturnType<typeof vi.fn>;

  const campaign: NotificationCampaignResponse = {
    id: 'c1',
    title: 'Promo',
    body: 'Corte con descuento',
    targetSummary: 'Todos los clientes',
    recipientCount: 12,
    sentByName: 'Admin',
    createdAtUtc: '2026-11-13T15:00:00Z',
  };

  async function create(): Promise<void> {
    api = {
      getCampaigns: vi.fn(() => of([])),
      previewBroadcast: vi.fn(() => of({ recipientCount: 12, targetSummary: 'Todos los clientes' })),
      broadcast: vi.fn(() => of(campaign)),
      searchCustomers: vi.fn(() => of([])),
    };
    confirm = vi.fn(async () => true);

    await TestBed.configureTestingModule({
      imports: [AdminNotificationsPageComponent],
      providers: [
        { provide: NotificationsApiService, useValue: api },
        { provide: AdminStaffApiService, useValue: { list: () => of([]) } },
        { provide: ConfirmModalService, useValue: { confirm } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNotificationsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function fillMessage(): void {
    component.broadcastForm.patchValue({ title: 'Promo', body: 'Corte con descuento' });
  }

  it('does not preselect «Todos los clientes»', async () => {
    await create();

    expect(component.targetType).toBeNull();
    const active = (fixture.nativeElement as HTMLElement).querySelectorAll('.admin-notifications-page__target-option.is-active');
    expect(active).toHaveLength(0);
  });

  it('asks for an audience before anything is counted or sent', async () => {
    await create();
    fillMessage();

    await component.submit();

    expect(component.errorMessage()).toBe('Elige a quién enviar la notificación.');
    expect(api.previewBroadcast).not.toHaveBeenCalled();
    expect(api.broadcast).not.toHaveBeenCalled();
  });

  it('confirms with the recipient count and a preview of the notice, then sends', async () => {
    await create();
    fillMessage();
    component.selectTargetType('all');

    await component.submit();

    expect(api.previewBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'all', title: 'Promo', body: 'Corte con descuento' }),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Llegará a 12 clientes (Todos los clientes). Así se verá:',
        preview: { title: 'Promo', body: 'Corte con descuento' },
        confirmLabel: 'Enviar a 12 clientes',
      }),
    );
    expect(api.broadcast).toHaveBeenCalledTimes(1);
    // After sending, the audience is cleared again.
    expect(component.targetType).toBeNull();
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    await create();
    fillMessage();
    component.selectTargetType('all');
    confirm.mockResolvedValue(false);

    await component.submit();

    expect(api.broadcast).not.toHaveBeenCalled();
    expect(component.broadcastForm.controls.title.value).toBe('Promo');
  });

  it('does not offer to send when no customer matches', async () => {
    await create();
    fillMessage();
    component.selectTargetType('all');
    api.previewBroadcast.mockReturnValue(of({ recipientCount: 0, targetSummary: 'Todos los clientes' }));

    await component.submit();

    expect(confirm).not.toHaveBeenCalled();
    expect(api.broadcast).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Ningún cliente activo coincide');
  });
});
