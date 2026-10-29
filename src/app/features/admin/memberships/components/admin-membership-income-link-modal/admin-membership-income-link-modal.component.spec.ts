import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import {
  CustomerMembershipDetailView,
  CustomerMembershipSummaryView,
  MembershipIncomeCandidateView,
} from '../../../../../core/models/membership.models';
import { AdminMembershipIncomeLinkModalComponent } from './admin-membership-income-link-modal.component';

describe('AdminMembershipIncomeLinkModalComponent', () => {
  let fixture: ComponentFixture<AdminMembershipIncomeLinkModalComponent>;
  let component: AdminMembershipIncomeLinkModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const membership = { id: 'm-1', customerId: 'c-1', price: 250000, soldOn: '2026-10-28' } as CustomerMembershipDetailView;
  const sibling = { id: 'm-2', planName: 'Oro', price: 250000, soldOn: '2026-10-28', incomeEntryId: null } as CustomerMembershipSummaryView;
  const alreadyPaid = { id: 'm-3', planName: 'Oro', price: 250000, soldOn: '2026-10-01', incomeEntryId: 'i-9' } as CustomerMembershipSummaryView;
  const income: MembershipIncomeCandidateView = {
    incomeEntryId: 'i-1',
    amount: 500000,
    occurredOn: '2026-10-28',
    linkedMembershipsTotal: 0,
    linkedMemberships: [],
  };

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMembershipIncomeLinkModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMembershipIncomeLinkModalComponent);
    component = fixture.componentInstance;
    component.membership = membership;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/memberships/income-candidates?date=2026-10-28`).flush([income]);
    httpMock.expectOne(`${api}/admin/customers/c-1/memberships`).flush([
      { ...membership, incomeEntryId: null } as unknown as CustomerMembershipSummaryView,
      sibling,
      alreadyPaid,
    ]);
    await flushMicrotasks();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('offers only the other unlinked memberships of the customer', () => {
    expect(component.siblings().map((candidate) => candidate.id)).toEqual(['m-2']);
  });

  it('requires a justification while the income and the memberships do not add up', () => {
    component.selectedIncomeId.set('i-1');

    expect(component.projectedTotal()).toBe(250000);
    expect(component.hasDiscrepancy()).toBe(true);
    expect(component.canConfirm()).toBe(false);

    component.justification.set('Pago parcial');
    expect(component.canConfirm()).toBe(true);
  });

  it('links the membership and the sibling paid with the same income, with no justification when they match', async () => {
    component.selectedIncomeId.set('i-1');
    component.toggleSibling('m-2', true);

    expect(component.projectedTotal()).toBe(500000);
    expect(component.hasDiscrepancy()).toBe(false);

    const linking = component.confirm();
    const req = httpMock.expectOne(`${api}/admin/memberships/m-1/income-link`);
    expect(req.request.body).toEqual({
      incomeEntryId: 'i-1',
      additionalMembershipIds: ['m-2'],
      discrepancyJustification: null,
    });
    req.flush(membership);
    await linking;
  });
});
