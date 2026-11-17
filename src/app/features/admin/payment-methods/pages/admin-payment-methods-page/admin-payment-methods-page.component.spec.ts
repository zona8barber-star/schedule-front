import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { AdminPaymentMethodsPageComponent } from './admin-payment-methods-page.component';

describe('AdminPaymentMethodsPageComponent', () => {
  const api = environment.defaultApiBaseUrl;
  let fixture: ComponentFixture<AdminPaymentMethodsPageComponent>;
  let component: AdminPaymentMethodsPageComponent;
  let httpMock: HttpTestingController;
  const methods = [
    { id: 'pm-1', name: 'Efectivo', sortOrder: 10, isActive: true },
    { id: 'pm-2', name: 'Otro', sortOrder: 50, isActive: false },
  ];

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPaymentMethodsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminPaymentMethodsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/admin/payment-methods`).flush(methods);
    await settle();
  });

  afterEach(() => httpMock.verify());

  it('lists the methods and deactivates one instead of deleting it', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-payment-method="pm-2"]')?.textContent).toContain('Inactivo');
    expect(element.textContent).not.toContain('Eliminar');

    component.openEdit(methods[0]);
    component.form.patchValue({ isActive: false });
    const saving = component.save();
    const request = httpMock.expectOne(`${api}/admin/payment-methods/pm-1`);
    expect(request.request.body).toEqual({ name: 'Efectivo', sortOrder: 10, isActive: false });
    request.flush({ ...methods[0], isActive: false });
    await settle();
    httpMock.expectOne(`${api}/admin/payment-methods`).flush([{ ...methods[0], isActive: false }, methods[1]]);
    await saving;

    expect(component.successMessage()).toBe('Método «Efectivo» actualizado.');
  });

  it('creates a method with its name trimmed', async () => {
    component.openNew();
    component.form.patchValue({ name: '  Datáfono ' });
    const saving = component.save();
    const request = httpMock.expectOne(`${api}/admin/payment-methods`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Datáfono', sortOrder: null, isActive: true });
    request.flush({ id: 'pm-3', name: 'Datáfono', sortOrder: 60, isActive: true });
    await settle();
    httpMock.expectOne(`${api}/admin/payment-methods`).flush(methods);
    await saving;

    expect(component.editing()).toBeNull();
  });
});
