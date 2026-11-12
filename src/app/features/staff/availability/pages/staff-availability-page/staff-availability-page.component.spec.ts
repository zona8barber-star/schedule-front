import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { UnavailablePeriod } from '../../../../../core/models/availability.models';
import { StaffAvailabilityPageComponent } from './staff-availability-page.component';

/** SONDA BUG-029: the absences tab must render a real em dash, never the mojibake «â€”». */
describe('StaffAvailabilityPageComponent absences', () => {
  const base = `${environment.defaultApiBaseUrl}/staff/availability`;
  let fixture: ComponentFixture<StaffAvailabilityPageComponent>;
  let httpMock: HttpTestingController;

  const period: UnavailablePeriod = {
    id: 'p1',
    startsAtUtc: '2030-11-23T14:00:00Z',
    endsAtUtc: '2030-11-23T15:00:00Z',
    reason: null,
    createdAtUtc: '2030-11-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffAvailabilityPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StaffAvailabilityPageComponent);

    httpMock.expectOne(base).flush({
      staffProfileId: 's1',
      defaultAppointmentDurationMinutes: 30,
      rules: [],
      unavailablePeriods: [period],
    });
    httpMock.expectOne(`${base}/unavailable-periods`).flush([period]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.componentInstance.activeTab.set('absences');
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('separates the period window with an em dash and shows one for a missing reason', () => {
    const row = (fixture.nativeElement as HTMLElement).querySelector('.avail-page__table tbody tr')!;
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent!.trim());

    expect(fixture.componentInstance.formatPeriodWindow(period)).toContain(' — ');
    expect(cells).toContain('—');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('â€');
  });
});
