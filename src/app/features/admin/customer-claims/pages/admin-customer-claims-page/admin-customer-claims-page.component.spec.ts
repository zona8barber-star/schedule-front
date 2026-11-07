import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CustomerClaimView } from '../../../../../core/models/customer-claim.models';
import { CustomerClaimsApiService } from '../../../../../core/services/customer-claims-api.service';
import { AdminCustomerClaimsPageComponent } from './admin-customer-claims-page.component';

const TOTAL = 201;
const PAGE_SIZE = 25;
const LAST_PAGE = Math.ceil(TOTAL / PAGE_SIZE); // 9

describe('AdminCustomerClaimsPageComponent (pagination and URL state)', () => {
  let fixture: ComponentFixture<AdminCustomerClaimsPageComponent>;
  let component: AdminCustomerClaimsPageComponent;
  let list: ReturnType<typeof vi.fn>;
  let router: Router;
  let location: Location;

  function claim(id: string): CustomerClaimView {
    return { id, accountFullName: `Cuenta ${id}`, status: 'Pending' } as unknown as CustomerClaimView;
  }

  async function render(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  /** Simulates opening (or reloading) the page at the current URL: a fresh component reads it. */
  async function open(): Promise<void> {
    fixture?.destroy();
    fixture = TestBed.createComponent(AdminCustomerClaimsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await render();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    // The server answers an empty page past the end, like the API does.
    list = vi.fn((status: string, query: { page: number; pageSize: number }) =>
      of({
        items: query.page <= LAST_PAGE ? [claim(`${status}-${query.page}`)] : [],
        page: query.page,
        pageSize: query.pageSize,
        totalCount: TOTAL,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [AdminCustomerClaimsPageComponent],
      providers: [provideRouter([]), provideLocationMocks(), { provide: CustomerClaimsApiService, useValue: { list } }],
    }).compileComponents();

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    // In the app the initial navigation starts listening to the browser history (popstate); TestBed does not.
    router.setUpLocationChangeListener();
    await router.navigateByUrl('/');
    await open();
  });

  it('asks for the first page of pending claims and shows the paginator', () => {
    expect(list).toHaveBeenLastCalledWith('Pending', { page: 1, pageSize: PAGE_SIZE });
    expect(component.totalCount()).toBe(TOTAL);
    expect(text()).toContain('Página 1 de 9');
    expect(router.url).toBe('/');
  });

  it('keeps the tab and a later page in the URL, so a reload opens the same page', async () => {
    component.selectTab('Rejected');
    await render();
    component.onPageChange(LAST_PAGE);
    await render();
    expect(router.url).toBe('/?status=Rejected&page=9');
    expect(component.claims().map((item) => item.id)).toEqual(['Rejected-9']);

    // Reload: a new instance at the same URL.
    list.mockClear();
    await open();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenLastCalledWith('Rejected', { page: 9, pageSize: PAGE_SIZE });
    expect(component.status()).toBe('Rejected');
    expect(text()).toContain('Página 9 de 9');
  });

  it('starts every tab on its first page', async () => {
    component.onPageChange(3);
    await render();
    expect(router.url).toBe('/?page=3');

    component.selectTab('Approved');
    await render();
    expect(router.url).toBe('/?status=Approved');
    expect(list).toHaveBeenLastCalledWith('Approved', { page: 1, pageSize: PAGE_SIZE });

    component.selectTab('Pending');
    await render();
    expect(router.url).toBe('/');
    expect(list).toHaveBeenLastCalledWith('Pending', { page: 1, pageSize: PAGE_SIZE });
  });

  it('follows the browser back and forward buttons', async () => {
    component.onPageChange(2);
    await render();
    component.selectTab('Rejected');
    await render();
    component.onPageChange(4);
    await render();
    expect(router.url).toBe('/?status=Rejected&page=4');

    location.back();
    await render();
    expect(router.url).toBe('/?status=Rejected');
    expect(list).toHaveBeenLastCalledWith('Rejected', { page: 1, pageSize: PAGE_SIZE });

    location.back();
    await render();
    expect(router.url).toBe('/?page=2');
    expect(component.status()).toBe('Pending');
    expect(list).toHaveBeenLastCalledWith('Pending', { page: 2, pageSize: PAGE_SIZE });

    location.forward();
    await render();
    expect(router.url).toBe('/?status=Rejected');
    expect(component.status()).toBe('Rejected');
    expect(component.page()).toBe(1);
  });

  it('reads an invalid URL safely: unknown tab and malformed page fall back to the first pending page', async () => {
    // The canonical URL is restored by customerClaimsQueryGuard (see its spec); the page itself never fails on it.
    await router.navigateByUrl('/?status=Hacked&page=abc');
    await open();

    expect(component.status()).toBe('Pending');
    expect(component.page()).toBe(1);
    expect(list).toHaveBeenLastCalledWith('Pending', { page: 1, pageSize: PAGE_SIZE });
    expect(list).not.toHaveBeenCalledWith('Hacked', expect.anything());
    expect(component.errorMessage()).toBeNull();
  });

  it('moves a page past the end to the last page instead of showing an empty list', async () => {
    await router.navigateByUrl('/?status=Rejected&page=50');
    await open();

    expect(router.url).toBe('/?status=Rejected&page=9');
    expect(component.claims().map((item) => item.id)).toEqual(['Rejected-9']);
    expect(text()).toContain('Página 9 de 9');
  });
});
