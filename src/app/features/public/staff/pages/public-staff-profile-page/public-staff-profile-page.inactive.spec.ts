import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../../../core/services/auth.service';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { PublicStaffReviewsApiService } from '../../../../../core/services/public-staff-reviews-api.service';
import { PublicStaffProfilePageComponent } from './public-staff-profile-page.component';

/**
 * SONDA BUG-186: the review notice links to the public profile; when the professional was deactivated afterwards, the
 * admin who opens it is sent to the professional's admin page instead of a dead end.
 */
describe('PublicStaffProfilePageComponent (deactivated professional)', () => {
  const staffProfileId = '5a1f0000-0000-4000-8000-000000000001';

  async function open(isAdmin: boolean): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [PublicStaffProfilePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ staffProfileId }), queryParamMap: convertToParamMap({}) } },
        },
        { provide: PublicStaffApiService, useValue: { getById: () => throwError(() => new HttpErrorResponse({ status: 404 })) } },
        {
          provide: PublicStaffReviewsApiService,
          useValue: { getSummaryByStaffProfileId: () => of({ averageStars: 0, totalReviews: 0 }), listByStaffProfileId: () => of([]) },
        },
        { provide: PublicAvailabilityApiService, useValue: { getSlots: () => of({ slots: [] }) } },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(AuthService), 'hasRole').mockImplementation((role) => isAdmin && role === 'Admin');

    const fixture = TestBed.createComponent(PublicStaffProfilePageComponent);
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sends the admin to the professional in «Profesionales»', async () => {
    const element = await open(true);

    expect(element.textContent).toContain('Este perfil no está publicado');
    expect(element.querySelector('[data-testid="not-found-back"]')!.getAttribute('href')).toBe(`/admin/staff/${staffProfileId}/edit`);
  });

  it('keeps «No encontramos este perfil profesional» for everyone else', async () => {
    const element = await open(false);

    expect(element.textContent).toContain('No encontramos este perfil profesional');
  });
});
