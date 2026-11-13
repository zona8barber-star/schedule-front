import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PublicStaffListItemResponse } from '../../../../../core/models/content.models';
import { environment } from '../../../../../../environments/environment';
import { PublicStaffListPageComponent } from './public-staff-list-page.component';

/** SONDA BUG-046: the search must filter in place, never fall back to a native form submit (full reload). */
describe('PublicStaffListPageComponent search', () => {
  const api = environment.defaultApiBaseUrl;
  let httpMock: HttpTestingController;
  let fixture: ComponentFixture<PublicStaffListPageComponent>;

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  const marco: PublicStaffListItemResponse = {
    staffProfileId: 's-1',
    displayName: 'Marco Fade',
    bio: null,
    phoneNumber: null,
    photoMediaAssetId: null,
    photoUrl: null,
    defaultAppointmentDurationMinutes: 30,
    averageRating: 4.5,
    reviewCount: 2,
    services: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicStaffListPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicStaffListPageComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/public/staff`).flush([]);
    await settle();
  });

  afterEach(() => httpMock.verify());

  function submitForm(): Event {
    const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event;
  }

  it('cancels the native submit and requests the filtered list', async () => {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#staffSearch')!;
    input.value = 'Marco';
    input.dispatchEvent(new Event('input'));

    const event = submitForm();

    expect(event.defaultPrevented).toBe(true);
    httpMock.expectOne(`${api}/public/staff?search=Marco`).flush([marco]);
    await settle();
    expect(fixture.componentInstance.staffMembers()).toEqual([marco]);
    expect(input.value).toBe('Marco');
  });

  it('submitting an empty search reloads the full list without a page reload', () => {
    const event = submitForm();

    expect(event.defaultPrevented).toBe(true);
    httpMock.expectOne(`${api}/public/staff`).flush([]);
  });

  // SONDA BUG-045: a list that could not be loaded is not «Sin coincidencias».
  it('when the list cannot be loaded, offers «Reintentar» instead of «Sin coincidencias»', async () => {
    void fixture.componentInstance.retryStaff();
    httpMock.expectOne(`${api}/public/staff`).error(new ProgressEvent('error'));
    await settle();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Sin coincidencias');

    element.querySelector<HTMLButtonElement>('[data-testid="load-error-retry"]')!.click();
    httpMock.expectOne(`${api}/public/staff`).flush([marco]);
    await settle();

    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(fixture.componentInstance.staffMembers()).toEqual([marco]);
  });
});
