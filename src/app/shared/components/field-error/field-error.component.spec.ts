import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { trimmedMinLength, trimmedRequired } from '../../../core/utils/form-validators';
import { FieldErrorComponent, fieldErrorMessage } from './field-error.component';

@Component({
  imports: [ReactiveFormsModule, FieldErrorComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="0">
      <input formControlName="name" />
      <app-field-error controlName="name" [kinds]="['required', 'minlength', 'maxlength']" />
      <button type="submit">Enviar</button>
    </form>
  `,
})
class HostComponent {
  readonly form = new FormGroup({
    name: new FormControl('', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]),
  });
}

/** SONDA BUG-008 / BUG-027: a field over its limit used to leave the form blocked without any message. */
describe('FieldErrorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="field-error"]')?.textContent ?? '';
  }

  it('stays silent until the field is touched or the form is submitted', () => {
    expect(text()).toBe('');

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    fixture.detectChanges();

    expect(text()).toBe('Este dato es obligatorio.');
  });

  it('explains the maximum with the current length', () => {
    const control = fixture.componentInstance.form.controls.name;
    control.setValue('a'.repeat(121));
    control.markAsTouched();
    fixture.detectChanges();

    expect(text()).toBe('Puede tener como máximo 120 caracteres (ahora tiene 121).');
  });

  it('counts the name without its spaces (" A ")', () => {
    const control = fixture.componentInstance.form.controls.name;
    control.setValue(' A ');
    control.markAsTouched();
    fixture.detectChanges();

    expect(text()).toBe('Debe tener al menos 2 caracteres.');
  });

  it('by default reports only the length limit', () => {
    expect(fieldErrorMessage({ required: true }, ['maxlength'])).toBeNull();
    expect(fieldErrorMessage({ maxlength: { requiredLength: 40, actualLength: 41 } }, ['maxlength'])).toContain('40');
  });
});
