import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { UnavailablePeriod } from '../../../../../core/models/availability.models';
import { setDeviceTimeZone } from '../../../../../testing/device-time-zone';
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

  /** SONDA BUG-036: the duration accepts the server range (10–240), not 5–480. */
  it.each([
    [5, false],
    [9, false],
    [10, true],
    [240, true],
    [241, false],
    [480, false],
  ])('accepts a default duration of %d minutes: %s', (minutes, valid) => {
    const control = fixture.componentInstance.durationControl;
    control.setValue(minutes);

    expect(control.valid).toBe(valid);
  });

  it('separates the period window with an em dash and shows one for a missing reason', () => {
    const row = (fixture.nativeElement as HTMLElement).querySelector('.avail-page__table tbody tr')!;
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent!.trim());

    expect(fixture.componentInstance.formatPeriodWindow(period)).toContain(' — ');
    expect(cells).toContain('—');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('â€');
  });
});

describe('StaffAvailabilityPageComponent weekly rules and Bogotá time', () => {
  const base = `${environment.defaultApiBaseUrl}/staff/availability`;
  const saturday = 6;
  let fixture: ComponentFixture<StaffAvailabilityPageComponent>;
  let httpMock: HttpTestingController;
  let restoreTimeZone: () => void;

  // SONDA BUG-030: the professional's device is in UTC; the shop works in Bogotá (UTC-5).
  beforeAll(() => (restoreTimeZone = setDeviceTimeZone('UTC')));
  afterAll(() => restoreTimeZone());

  const rule = (id: string, startTime: string, endTime: string) => ({
    id,
    dayOfWeek: saturday,
    startTime,
    endTime,
    isActive: true,
  });

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
      rules: [rule('r1', '09:00', '12:00')],
      unavailablePeriods: [],
    });
    httpMock.expectOne(`${base}/unavailable-periods`).flush([]);
    await settle();
  });

  afterEach(() => httpMock.verify());

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const saturdayCard = () => element().querySelectorAll<HTMLElement>('.avail-page__day-card')[saturday];
  const blocks = () => Array.from(saturdayCard().querySelectorAll<HTMLElement>('.avail-page__block'));
  const saveButton = () => element().querySelector<HTMLButtonElement>('.avail-page__submit')!;

  function typeTime(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  /** SONDA BUG-038: add a block, save, remove it, then make the first block end before it starts. */
  it('keeps validating the blocks the screen shows after adding, saving and removing blocks', async () => {
    saturdayCard().querySelector<HTMLButtonElement>('.avail-page__btn-add-block')!.click();
    await settle();
    const [, second] = blocks();
    typeTime(second.querySelector<HTMLInputElement>('input[id^="start-"]')!, '14:00');
    typeTime(second.querySelector<HTMLInputElement>('input[id^="end-"]')!, '16:00');
    await settle();

    saveButton().click();
    await settle();
    httpMock
      .expectOne((request) => request.method === 'PUT' && request.url === `${base}/rules`)
      .flush([rule('r1', '09:00', '12:00'), rule('r2', '14:00', '16:00')]);
    await settle();

    blocks()[1].querySelector<HTMLButtonElement>('.avail-page__btn-remove-block')!.click();
    await settle();
    expect(blocks().length).toBe(1);

    const [first] = blocks();
    typeTime(first.querySelector<HTMLInputElement>('input[id^="start-"]')!, '11:00');
    typeTime(first.querySelector<HTMLInputElement>('input[id^="end-"]')!, '10:00');
    await settle();

    // What is validated (and would be sent) is what the screen shows.
    const days = fixture.componentInstance.daysArray.getRawValue();
    expect(days.find((day) => day.dayOfWeek === saturday)!.blocks).toEqual([{ startTime: '11:00', endTime: '10:00' }]);
    expect(saveButton().disabled).toBe(true);

    fixture.componentInstance.saveRules();
    await settle();
    httpMock.expectNone(`${base}/rules`);
    expect(element().textContent).toContain('La hora de inicio debe ser anterior a la hora de fin.');
  });

  it('stores an absence entered as 09:00-10:00 as 09:00-10:00 in Bogotá (14:00Z-15:00Z)', async () => {
    const component = fixture.componentInstance;
    component.openAbsenceModal();
    component.absenceForm.setValue({
      isAllDay: false,
      startValue: '2030-11-25T09:00',
      endValue: '2030-11-25T10:00',
      reason: '',
    });

    void component.submitAbsence();
    const request = httpMock.expectOne((r) => r.method === 'POST' && r.url === `${base}/unavailable-periods`);
    expect(request.request.body).toEqual({
      startsAtUtc: '2030-11-25T14:00:00.000Z',
      endsAtUtc: '2030-11-25T15:00:00.000Z',
      reason: null,
    });
    request.flush({});
    await settle();
    httpMock.expectOne(`${base}/unavailable-periods`).flush([]);
    await settle();
  });

  it('opens a stored absence in Bogotá time for editing and shows its window in Bogotá', () => {
    const period = {
      id: 'p9',
      startsAtUtc: '2030-11-25T14:00:00Z',
      endsAtUtc: '2030-11-25T15:00:00Z',
      reason: null,
      createdAtUtc: '2030-11-01T00:00:00Z',
    };
    const component = fixture.componentInstance;

    component.openAbsenceModal(period);

    expect(component.absenceForm.getRawValue()).toMatchObject({
      startValue: '2030-11-25T09:00',
      endValue: '2030-11-25T10:00',
    });
    expect(component.formatPeriodWindow(period)).toMatch(/9:00.*—.*10:00/);
  });
});
