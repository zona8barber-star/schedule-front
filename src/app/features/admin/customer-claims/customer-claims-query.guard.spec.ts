import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { customerClaimsQueryGuard } from './customer-claims-query.guard';

@Component({ template: '' })
class InboxStubComponent {}

describe('customerClaimsQueryGuard', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([
          {
            path: 'admin/customer-claims',
            component: InboxStubComponent,
            canActivate: [customerClaimsQueryGuard],
            runGuardsAndResolvers: 'paramsOrQueryParamsChange',
          },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  it('lets a canonical URL through unchanged', async () => {
    await router.navigateByUrl('/admin/customer-claims?status=Rejected&page=3');
    expect(router.url).toBe('/admin/customer-claims?status=Rejected&page=3');
  });

  it('turns an unknown tab and a malformed page into the first pending page', async () => {
    await router.navigateByUrl('/admin/customer-claims?status=Hacked&page=abc');
    expect(router.url).toBe('/admin/customer-claims');
  });

  it('drops the default values and keeps a valid tab with an invalid page', async () => {
    await router.navigateByUrl('/admin/customer-claims?status=Pending&page=1');
    expect(router.url).toBe('/admin/customer-claims');

    await router.navigateByUrl('/admin/customer-claims?status=Approved&page=-4');
    expect(router.url).toBe('/admin/customer-claims?status=Approved');
  });

  it('also corrects a bad URL reached by a query change on the same page', async () => {
    await router.navigateByUrl('/admin/customer-claims?status=Rejected&page=2');
    await router.navigateByUrl('/admin/customer-claims?status=Rejected&page=2.5');
    expect(router.url).toBe('/admin/customer-claims?status=Rejected');
    expect(location.path()).toBe('/admin/customer-claims?status=Rejected');
  });
});
