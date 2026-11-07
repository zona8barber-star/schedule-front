import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { MyMembershipSummaryView } from '../../../../../core/models/my-membership.models';
import { CustomerMembershipsPageComponent } from './customer-memberships-page.component';

describe('CustomerMembershipsPageComponent', () => {
  let fixture: ComponentFixture<CustomerMembershipsPageComponent>;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const summary = (overrides: Partial<MyMembershipSummaryView>): MyMembershipSummaryView => ({
    id: 'm-1',
    planName: 'Membresía Oro',
    displayStatus: 'Active',
    startsOn: '2026-10-01',
    endsOn: '2026-10-30',
    purchasedGranted: 10,
    purchasedAvailable: 9,
    giftedGranted: 2,
    giftedAvailable: 0,
    pendingPhysicalGifts: 1,
    ...overrides,
  });

  async function render(memberships: MyMembershipSummaryView[]): Promise<HTMLElement> {
    httpMock
      .expectOne((request) => request.url === `${api}/customer/memberships`)
      .flush({ items: memberships, page: 1, pageSize: 20, totalCount: memberships.length });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerMembershipsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerMembershipsPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('explains what to do when there are no memberships or no linked profile', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('Aún no tienes membresías');
    expect(element.textContent).toContain('solicita vincular tu perfil de cliente');
    expect(fixture.nativeElement.querySelector('a[href="/customer/customer-profile"]')).toBeTruthy();
  });

  it('lists each membership with its status, validity and paid and gifted balances', async () => {
    const element = await render([summary({})]);
    const text = element.textContent ?? '';

    expect(text).toContain('Membresía Oro');
    expect(text).toContain('Vigente');
    expect(text).toContain('2026-10-01 al 2026-10-30');
    expect(text).toContain('9 de 10 disponibles');
    expect(text).toContain('0 de 2 disponibles');
    expect(text).toContain('Obsequios por recibir');
    expect(element.querySelector('a.my-memberships__card')?.getAttribute('href')).toBe('/customer/memberships/m-1');
  });

  it('marks the balances of pending, expired and annulled memberships as not usable', async () => {
    const element = await render([
      summary({ id: 'p', displayStatus: 'PendingActivation' }),
      summary({ id: 'e', displayStatus: 'Expired' }),
      summary({ id: 'a', displayStatus: 'Annulled' }),
    ]);
    const blocked = [...element.querySelectorAll('.my-memberships__notice--blocked')].map((notice) => notice.textContent?.trim());

    expect(blocked).toEqual([
      'Bloqueados hasta que la barbería active tu membresía.',
      'La membresía venció el 2026-10-30; los saldos ya no se pueden usar.',
      'Bloqueados: la membresía fue anulada.',
    ]);
    expect(element.textContent).toContain('Pendiente de activación');
    expect(element.textContent).toContain('Vencida');
    expect(element.textContent).toContain('Anulada');
  });

  it('filters by status and sale date through the URL and asks the API for the first page', async () => {
    const element = await render([summary({})]);
    const router = TestBed.inject(Router);

    const status = element.querySelector('[data-testid="membership-status-filter"]') as HTMLSelectElement;
    status.value = 'Expired';
    status.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(router.url).toBe('/?status=Expired');
    const request = httpMock.expectOne((candidate) => candidate.url === `${api}/customer/memberships`);
    expect(request.request.params.get('status')).toBe('Expired');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ items: [], page: 1, pageSize: 20, totalCount: 0 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.textContent).toContain('No tienes membresías que coincidan con los filtros.');
  });
});
