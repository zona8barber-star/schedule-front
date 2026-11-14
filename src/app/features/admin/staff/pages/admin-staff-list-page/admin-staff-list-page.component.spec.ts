import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminStaffListPageComponent } from './admin-staff-list-page.component';

/** SONDA BUG-071: there is no delete endpoint; the list deactivates or reactivates through PATCH .../status. */
describe('AdminStaffListPageComponent status action', () => {
  let fixture: ComponentFixture<AdminStaffListPageComponent>;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const alex: StaffListItem = {
    staffProfileId: 'st-1',
    userId: 'u-1',
    fullName: 'Alex Barbero',
    email: 'alex@example.com',
    phoneNumber: null,
    displayName: 'Alex',
    bio: null,
    defaultAppointmentDurationMinutes: 30,
    photoMediaAssetId: null,
    photoUrl: null,
    tipsQrMediaAssetId: null,
    tipsQrUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    tikTokUrl: null,
    youtubeUrl: null,
    xUrl: null,
    isActive: true,
    createdAt: '',
    updatedAt: null,
  };

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  function toggle(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="staff-status-toggle"]')!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStaffListPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => true, hasRole: () => false } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStaffListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/admin/staff`).flush([alex]);
    await flushMicrotasks();
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('offers «Desactivar» instead of a delete that the API does not have', () => {
    expect(toggle().textContent!.trim()).toBe('Desactivar');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Eliminar');
  });

  it('deactivates through the status endpoint after confirming, and then offers «Activar»', async () => {
    const modal = TestBed.inject(ConfirmModalService);

    toggle().click();
    expect(modal.state()!.options.title).toBe('¿Desactivar profesional?');
    modal._resolve(true);
    await flushMicrotasks();

    const request = httpMock.expectOne(`${api}/admin/staff/st-1/status`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ isActive: false });
    request.flush({ ...alex, isActive: false });
    await flushMicrotasks();
    fixture.detectChanges();

    expect(toggle().textContent!.trim()).toBe('Activar');
    httpMock.expectNone((candidate) => candidate.method === 'DELETE');
  });
});
