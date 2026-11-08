import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerClaimCandidate, CustomerClaimView } from '../../../../../core/models/customer-claim.models';
import { AdminCustomerClaimReviewModalComponent } from './admin-customer-claim-review-modal.component';

describe('AdminCustomerClaimReviewModalComponent', () => {
  let fixture: ComponentFixture<AdminCustomerClaimReviewModalComponent>;
  let component: AdminCustomerClaimReviewModalComponent;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customer-claims`;

  const claim: CustomerClaimView = {
    id: 'k-1',
    status: 'Pending',
    userId: 'u-1',
    accountFullName: 'Carla Cliente',
    accountEmail: 'carla@example.com',
    accountIsActive: true,
    fullName: 'Carla Cliente',
    phone: '3001234567',
    email: 'carla@example.com',
    notes: 'Cliente desde 2024',
    submittedAt: '2026-11-03T10:00:00Z',
    approvedCustomerId: null,
    approvedCustomerName: null,
    decidedAt: null,
    decidedByName: null,
    decisionNotes: null,
    version: 77,
  };

  const free: CustomerClaimCandidate = {
    customerId: 'c-1', fullName: 'Carla P.', phoneHint: '•••4567', emailHint: 'c•••@example.com',
    createdAt: '2025-01-01T00:00:00Z', membershipCount: 2, isLinked: false, matchedOn: ['phone'],
  };
  const taken: CustomerClaimCandidate = { ...free, customerId: 'c-2', fullName: 'Otra Carla', isLinked: true, matchedOn: [] };

  async function open(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerClaimReviewModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminCustomerClaimReviewModalComponent);
    component = fixture.componentInstance;
    component.claim = claim;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${base}/k-1/candidates`).flush([free, taken]);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows suggestions as hints and does not let a linked profile be chosen', async () => {
    await open();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('•••4567');
    expect(text).toContain('coincide en teléfono');
    expect(text).toContain('ya está vinculado a otra cuenta');
    component.select(taken);
    expect(component.selected()).toBeNull();
  });

  it('requires a chosen profile and the in-person verification before approving', async () => {
    await open();

    await component.approve();
    expect(component.errorMessage()).toBe('Elige el perfil del cliente.');
    component.select(free);
    await component.approve();
    expect(component.errorMessage()).toContain('verificaste la identidad');
    httpMock.expectNone(`${base}/k-1/approve`);

    component.form.patchValue({ identityVerified: true, notes: 'Cédula vista' });
    const approving = component.approve();
    const req = httpMock.expectOne(`${base}/k-1/approve`);
    expect(req.request.body).toEqual({ version: 77, customerId: 'c-1', identityVerified: true, notes: 'Cédula vista' });
    req.flush({ ...claim, status: 'Approved' });
    await approving;
  });

  it('rejects with a reason and explains conflicts', async () => {
    await open();
    component.rejecting.set(true);
    component.form.patchValue({ reason: 'No presentó documento' });

    const rejecting = component.reject();
    httpMock.expectOne(`${base}/k-1/reject`).flush(
      { detail: 'La solicitud ya fue revisada por otra persona. Recarga la bandeja.' },
      { status: 409, statusText: 'Conflict' },
    );
    await rejecting;

    expect(component.hasConflict()).toBe(true);
    expect(component.errorMessage()).toContain('ya fue revisada');
  });

  it('searches profiles with the reviewer query', async () => {
    await open();
    component.form.patchValue({ query: 'Carla' });

    const searching = component.search();
    const req = httpMock.expectOne((request) => request.url === `${base}/k-1/candidates`);
    expect(req.request.params.get('q')).toBe('Carla');
    req.flush([free]);
    await searching;

    expect(component.candidates()).toEqual([free]);
  });
});
