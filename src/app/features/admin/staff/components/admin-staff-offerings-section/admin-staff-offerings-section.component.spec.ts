import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { GeneralServiceView, ServiceCategoryView } from '../../../../../core/models/service-catalog.models';
import { StaffOfferingView, StaffOfferingsView } from '../../../../../core/models/staff.models';
import { AdminStaffOfferingsSectionComponent } from './admin-staff-offerings-section.component';

describe('AdminStaffOfferingsSectionComponent', () => {
  let fixture: ComponentFixture<AdminStaffOfferingsSectionComponent>;
  let component: AdminStaffOfferingsSectionComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;
  const staffId = 'st-1';

  const category = (id: string, name: string, sortOrder: number, isActive = true): ServiceCategoryView => ({
    id,
    name,
    sortOrder,
    publicCode: id,
    isActive,
    generalServiceCount: 0,
    activeGeneralServiceCount: 0,
    createdAt: '',
    updatedAt: null,
  });

  const generalService = (
    id: string,
    name: string,
    categoryId: string,
    categoryName: string,
    sortOrder: number,
    isActive = true,
  ): GeneralServiceView => ({
    id,
    categoryId,
    categoryName,
    categoryIsActive: true,
    name,
    description: null,
    sortOrder,
    publicCode: id,
    isActive,
    rateCount: 1,
    activeRateCount: 1,
    createdAt: '',
    updatedAt: null,
  });

  const offering = (generalServiceId: string, name: string, durationMinutes: number, extra: Partial<StaffOfferingView> = {}): StaffOfferingView => ({
    generalServiceId,
    generalServiceName: name,
    categoryId: 'c-barber',
    categoryName: 'Barbería',
    durationMinutes,
    isActive: true,
    generalServiceIsActive: true,
    categoryIsActive: true,
    createdAt: '',
    updatedAt: null,
    ...extra,
  });

  const categories = [category('c-nails', 'Uñas', 2), category('c-barber', 'Barbería', 1)];
  const generalServices = [
    generalService('g-beard', 'Barba', 'c-barber', 'Barbería', 2),
    generalService('g-mani', 'Manicure', 'c-nails', 'Uñas', 1),
    generalService('g-cut', 'Corte', 'c-barber', 'Barbería', 1),
    generalService('g-old', 'Tinte', 'c-barber', 'Barbería', 3, false),
  ];

  async function open(offerings: StaffOfferingView[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminStaffOfferingsSectionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStaffOfferingsSectionComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('staffId', staffId);
    fixture.detectChanges();

    const view: StaffOfferingsView = { staffProfileId: staffId, defaultAppointmentDurationMinutes: 30, offerings };
    httpMock.expectOne(`${api}/admin/staff/${staffId}/offerings`).flush(view);
    httpMock.expectOne(`${api}/admin/service-categories`).flush(categories);
    httpMock.expectOne(`${api}/admin/general-services`).flush(generalServices);
    // Promise.all over the three requests: let the awaited chain settle before rendering.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  function checkbox(generalServiceId: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[data-service-id="${generalServiceId}"]`) as HTMLInputElement;
  }

  function durationInput(generalServiceId: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(`input[data-duration-for="${generalServiceId}"]`) as HTMLInputElement;
  }

  it('groups the active general services by category order, then service order', async () => {
    await open([offering('g-beard', 'Barba', 20)]);

    expect(component.groups().map((group) => [group.categoryName, group.rows.map((row) => row.name)])).toEqual([
      ['Barbería', ['Corte', 'Barba']],
      ['Uñas', ['Manicure']],
    ]);
    const legends = Array.from(fixture.nativeElement.querySelectorAll('legend') as NodeListOf<HTMLElement>).map(
      (legend) => legend.textContent?.trim(),
    );
    expect(legends).toEqual(['Barbería', 'Uñas']);
  });

  it('checks the offered services with their duration and defaults the rest to the professional duration', async () => {
    await open([offering('g-beard', 'Barba', 20)]);

    expect(checkbox('g-beard').checked).toBe(true);
    expect(durationInput('g-beard').value).toBe('20');
    expect(checkbox('g-cut').checked).toBe(false);
    expect(durationInput('g-cut').value).toBe('30');
    expect(durationInput('g-cut').disabled).toBe(true);
  });

  it('saves the checked services with their durations as a full replacement', async () => {
    await open([offering('g-beard', 'Barba', 20)]);

    checkbox('g-cut').click();
    fixture.detectChanges();
    const cutDuration = durationInput('g-cut');
    cutDuration.value = '45';
    cutDuration.dispatchEvent(new Event('input'));
    checkbox('g-beard').click();
    fixture.detectChanges();

    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/staff/${staffId}/offerings`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      offerings: [{ generalServiceId: 'g-cut', durationMinutes: 45, isActive: true }],
    });
    req.flush({
      staffProfileId: staffId,
      defaultAppointmentDurationMinutes: 30,
      offerings: [offering('g-cut', 'Corte', 45)],
    });
    await saving;
    fixture.detectChanges();

    expect(checkbox('g-cut').checked).toBe(true);
    expect(checkbox('g-beard').checked).toBe(false);
    expect(component.successMessage()).toBe('Servicios del profesional guardados.');
  });

  it('keeps offerings of inactive general services, shown read-only, when saving', async () => {
    await open([
      offering('g-cut', 'Corte', 30),
      offering('g-old', 'Tinte', 90, { generalServiceIsActive: false }),
    ]);

    const inactive = fixture.nativeElement.querySelector('[data-testid="inactive-offerings"]') as HTMLElement;
    expect(inactive.textContent).toContain('Tinte');
    expect(inactive.textContent).toContain('Servicio general inactivo');
    expect(checkbox('g-old')).toBeNull();

    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/staff/${staffId}/offerings`);
    expect(req.request.body.offerings).toEqual([
      { generalServiceId: 'g-cut', durationMinutes: 30, isActive: true },
      { generalServiceId: 'g-old', durationMinutes: 90, isActive: true },
    ]);
    req.flush({ staffProfileId: staffId, defaultAppointmentDurationMinutes: 30, offerings: [] });
    await saving;
  });

  it('blocks durations outside 10–240 minutes without calling the API', async () => {
    await open([offering('g-cut', 'Corte', 30)]);

    const input = durationInput('g-cut');
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    await component.save();
    fixture.detectChanges();

    httpMock.expectNone(`${api}/admin/staff/${staffId}/offerings`);
    expect(component.errorMessage()).toContain('entre 10 y 240');
    expect(fixture.nativeElement.textContent).toContain('Entre 10 y 240 minutos.');
  });

  it('shows the API validation error', async () => {
    await open([offering('g-cut', 'Corte', 30)]);

    const saving = component.save();
    httpMock.expectOne(`${api}/admin/staff/${staffId}/offerings`).flush(
      { title: 'Validación', errors: { 'offerings[0].generalServiceId': ['El servicio general no existe.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await saving;
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('El servicio general no existe.');
  });
});
