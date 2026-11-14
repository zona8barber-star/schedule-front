import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { FormA11yDirective } from './form-a11y.directive';

@Component({
  imports: [ReactiveFormsModule, FormA11yDirective],
  template: `
    <form appFormA11y [formGroup]="form" (ngSubmit)="0" novalidate>
      <div class="auth-field">
        <label for="email">Correo</label>
        <input id="email" formControlName="email" />
        @if (form.controls.email.invalid && (form.controls.email.touched || submitted)) {
          <p role="alert" class="auth-field__error">Ingresa tu correo electrónico.</p>
        }
      </div>
      <div class="auth-field">
        <label for="password">Contraseña</label>
        <input id="password" formControlName="password" />
      </div>
      <button id="send" type="submit">Iniciar sesión</button>
    </form>
  `,
})
class HostComponent {
  submitted = false;
  readonly form = new FormGroup({
    email: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });
}

/** SONDA BUG-010: errors announced and the focus on the first wrong field. */
describe('FormA11yDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    fixture.detectChanges();
  });

  afterEach(() => element.remove());

  async function submit(): Promise<void> {
    const button = element.querySelector<HTMLButtonElement>('#send')!;
    button.focus();
    fixture.componentInstance.submitted = true;
    button.click();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('moves the focus to the first invalid field instead of leaving it on the button', async () => {
    await submit();

    expect(document.activeElement?.id).toBe('email');
  });

  it('marks invalid fields and links them to their message', async () => {
    await submit();
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const message = element.querySelector<HTMLElement>('.auth-field__error')!;

    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.getAttribute('role')).toBe('alert');
    expect(element.querySelector('#password')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the marks once the field is valid', async () => {
    await submit();
    fixture.componentInstance.form.controls.email.setValue('ana@example.com');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const email = element.querySelector<HTMLInputElement>('#email')!;
    expect(email.hasAttribute('aria-invalid')).toBe(false);
    expect(email.hasAttribute('aria-describedby')).toBe(false);
  });
});
