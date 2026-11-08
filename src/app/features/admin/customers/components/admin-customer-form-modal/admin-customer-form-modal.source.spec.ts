import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CustomerDetailView, CustomerDuplicateCandidate } from '../../../../../core/models/customer.models';
import {
  AdminCustomerFormModalComponent,
  CreatedCustomerSummary,
  CustomerCreationSource,
} from './admin-customer-form-modal.component';

describe('AdminCustomerFormModalComponent with a creation source', () => {
  let fixture: ComponentFixture<AdminCustomerFormModalComponent>;
  let component: AdminCustomerFormModalComponent;
  let httpMock: HttpTestingController;

  const duplicate: CustomerDuplicateCandidate = {
    kind: 'customer',
    id: 'c-old',
    fullName: 'Cliente Existente',
    email: 'nuevo@example.com',
    phone: null,
    matchedOn: ['email'],
    isLinked: false,
  };

  async function open(source: CustomerCreationSource): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerFormModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminCustomerFormModalComponent);
    component = fixture.componentInstance;
    component.source = source;
    component.initialName = 'Cliente de paso';
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => {
    // The customers module routes are never called when a source is given.
    httpMock.verify();
  });

  it('prefills the name, warns about duplicates once, then creates through the source', async () => {
    const created: CreatedCustomerSummary = { id: 'c-new', fullName: 'Cliente de paso' };
    const source = {
      findDuplicates: vi.fn(() => of([duplicate])),
      create: vi.fn(() => of(created)),
    };
    await open(source);
    expect(component.form.controls.fullName.value).toBe('Cliente de paso');
    const saved: CustomerDetailView[] = [];
    const fromSource: CreatedCustomerSummary[] = [];
    component.saved.subscribe((value) => saved.push(value));
    component.createdFromSource.subscribe((value) => fromSource.push(value));

    component.form.patchValue({ phone: '3007654321', email: 'nuevo@example.com' });
    await component.submit();
    expect(source.findDuplicates).toHaveBeenCalledWith('nuevo@example.com', '3007654321');
    expect(component.duplicates()).toEqual([duplicate]);
    expect(source.create).not.toHaveBeenCalled();

    await component.submit();
    expect(source.create).toHaveBeenCalledWith({ fullName: 'Cliente de paso', phone: '3007654321', email: 'nuevo@example.com' });
    // The reduced answer goes out through its own output; the full-detail one stays for the customers module.
    expect(fromSource).toEqual([created]);
    expect(saved).toEqual([]);
  });
});
