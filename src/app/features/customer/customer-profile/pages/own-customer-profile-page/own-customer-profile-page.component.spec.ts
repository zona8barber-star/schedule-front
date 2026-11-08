import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { OwnCustomerStatusView } from '../../../../../core/models/customer-claim.models';
import { OwnCustomerProfilePageComponent } from './own-customer-profile-page.component';

describe('OwnCustomerProfilePageComponent', () => {
  let fixture: ComponentFixture<OwnCustomerProfilePageComponent>;
  let component: OwnCustomerProfilePageComponent;
  let httpMock: HttpTestingController;
  const url = `${environment.defaultApiBaseUrl}/customer/customer-profile`;

  const noProfile: OwnCustomerStatusView = {
    profile: null,
    pendingClaim: null,
    claims: [],
    accountFullName: 'Carla Cliente',
    accountEmail: 'carla@example.com',
    accountPhone: '3001234567',
  };

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(status: OwnCustomerStatusView): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [OwnCustomerProfilePageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnCustomerProfilePageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(url).flush(status);
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('offers both choices to an account without profile', async () => {
    await open(noProfile);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Soy cliente nuevo');
    expect(text).toContain('Ya soy cliente');
  });

  it('creates the own profile with the account data prefilled', async () => {
    await open(noProfile);
    component.choose('new');
    expect(component.form.getRawValue()).toEqual({ fullName: 'Carla Cliente', phone: '3001234567', email: 'carla@example.com', notes: '' });

    const submitting = component.submit();
    const create = httpMock.expectOne((request) => request.url === url && request.method === 'POST');
    expect(create.request.body).toEqual({ fullName: 'Carla Cliente', phone: '3001234567', email: 'carla@example.com' });
    create.flush({ id: 'c-1', fullName: 'Carla Cliente', phone: '3001234567', email: 'carla@example.com', linkedAt: '2026-11-03T10:00:00Z' });
    await flushMicrotasks();
    httpMock.expectOne((request) => request.url === url && request.method === 'GET').flush({
      ...noProfile,
      profile: { id: 'c-1', fullName: 'Carla Cliente', phone: '3001234567', email: 'carla@example.com', linkedAt: '2026-11-03T10:00:00Z' },
    });
    await submitting;
    fixture.detectChanges();

    expect(component.successMessage()).toContain('ya tienes tu perfil');
    expect(fixture.nativeElement.textContent).toContain('Ver mis membresías');
  });

  it('sends a claim with a stable key on retries and then shows it as pending', async () => {
    await open(noProfile);
    component.choose('existing');
    component.form.patchValue({ notes: 'Cliente desde 2024' });

    const first = component.submit();
    const failed = httpMock.expectOne(`${url}/claims`);
    const key = failed.request.body.idempotencyKey;
    failed.flush({ detail: 'No pudimos conectarnos.' }, { status: 503, statusText: 'Unavailable' });
    await first;

    const second = component.submit();
    const retried = httpMock.expectOne(`${url}/claims`);
    expect(retried.request.body.idempotencyKey).toBe(key);
    expect(retried.request.body.notes).toBe('Cliente desde 2024');
    const claim = { id: 'k-1', status: 'Pending' as const, fullName: 'Carla Cliente', phone: '3001234567', email: 'carla@example.com', notes: null, submittedAt: '2026-11-03T10:00:00Z', decidedAt: null, rejectionReason: null };
    retried.flush(claim);
    await flushMicrotasks();
    httpMock.expectOne(url).flush({ ...noProfile, pendingClaim: claim, claims: [claim] });
    await second;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Solicitud en revisión');
    expect(fixture.nativeElement.textContent).not.toContain('Soy cliente nuevo');
  });

  it('shows the reason of a rejected claim and lets the customer choose again', async () => {
    await open({
      ...noProfile,
      claims: [{ id: 'k-1', status: 'Rejected', fullName: 'Carla', phone: '300', email: 'c@example.com', notes: null, submittedAt: '2026-11-01T10:00:00Z', decidedAt: '2026-11-02T10:00:00Z', rejectionReason: 'No presentó documento' }],
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Motivo: No presentó documento');
    expect(text).toContain('Ya soy cliente');
  });
});
