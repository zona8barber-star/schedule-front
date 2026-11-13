import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { PublicStaffProfileResponse } from '../../../../../core/models/content.models';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { PublicStaffReviewsApiService } from '../../../../../core/services/public-staff-reviews-api.service';
import { PublicStaffProfilePageComponent } from './public-staff-profile-page.component';

const profile: PublicStaffProfileResponse = {
  staffProfileId: 'st-1',
  displayName: 'Alex',
  bio: null,
  phoneNumber: null,
  photoMediaAssetId: null,
  photoUrl: null,
  tipsQrMediaAssetId: null,
  tipsQrUrl: null,
  defaultAppointmentDurationMinutes: 30,
  averageRating: 4.5,
  reviewCount: 2,
  services: [],
  instagramUrl: null,
  facebookUrl: null,
  tikTokUrl: null,
  youtubeUrl: null,
  xUrl: null,
};

/** SONDA BUG-045: without network the profile said «No encontramos este perfil profesional», which was false. */
describe('PublicStaffProfilePageComponent (load errors)', () => {
  let fixture: ComponentFixture<PublicStaffProfilePageComponent>;
  let getById: ReturnType<typeof vi.fn>;

  async function open(firstAnswer: () => Observable<PublicStaffProfileResponse>): Promise<HTMLElement> {
    getById = vi.fn(firstAnswer);
    await TestBed.configureTestingModule({
      imports: [PublicStaffProfilePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ staffProfileId: 'st-1' }), queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: PublicStaffApiService, useValue: { getById } },
        {
          provide: PublicStaffReviewsApiService,
          useValue: {
            getSummaryByStaffProfileId: () => of({ averageStars: 4.5, totalReviews: 2 }),
            listByStaffProfileId: () => of([]),
          },
        },
        { provide: PublicAvailabilityApiService, useValue: { getSlots: () => of({ slots: [] }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicStaffProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('without network shows «Sin conexión» with «Reintentar», not «No encontramos»', async () => {
    const element = await open(() => throwError(() => new HttpErrorResponse({ status: 0 })));

    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();
    expect(element.textContent).toContain('Sin conexión');
    expect(element.textContent).not.toContain('No encontramos este perfil profesional');
  });

  it('«Reintentar» loads the profile again', async () => {
    const element = await open(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    getById.mockReturnValue(of(profile));

    element.querySelector<HTMLButtonElement>('[data-testid="load-error-retry"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getById).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(element.textContent).toContain('Alex');
  });

  it('a real 404 still says the profile does not exist', async () => {
    const element = await open(() => throwError(() => new HttpErrorResponse({ status: 404 })));

    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(element.textContent).toContain('No encontramos este perfil profesional');
  });
});
