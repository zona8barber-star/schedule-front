import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthApiService } from '../../../../core/services/auth-api.service';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';

import { FieldErrorComponent } from '../../../../shared/components/field-error/field-error.component';
import { trimmedMinLength, trimmedRequired } from '../../../../core/utils/form-validators';

import { FormA11yDirective } from '../../../../shared/directives/form-a11y.directive';

import { SingleFlight } from '../../../../core/utils/single-flight';
import { getApiErrorMessage, isConnectivityError, statusMessage } from '../../../../core/utils/api-error.utils';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login-page',
  imports: [FormA11yDirective, FieldErrorComponent, ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authApiService = inject(AuthApiService);

  readonly authService = inject(AuthService);

  readonly minimumPasswordLength = 8;
  readonly maximumPasswordLength = 128;

  readonly isRegisterTab = this.route.snapshot.routeConfig?.path === 'register';
  readonly tabQueryParams = this.buildTabQueryParams();

  readonly loginSubmitted = signal(false);
  readonly registerSubmitted = signal(false);

  readonly isLoginPasswordVisible = signal(false);
  readonly isRegisterPasswordVisible = signal(false);
  readonly isConfirmPasswordVisible = signal(false);

  // ── Forgot password ──────────────────────────────────────────────────────────
  readonly showForgotPanel = signal(false);
  readonly forgotSubmitted = signal(false);
  readonly forgotLoading = signal(false);
  readonly forgotError = signal('');
  readonly forgotSent = signal(false);

  readonly forgotForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  // ─────────────────────────────────────────────────────────────────────────────

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly registerForm = this.formBuilder.nonNullable.group(
    {
      fullName: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.maxLength(40)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(this.minimumPasswordLength),
          Validators.maxLength(this.maximumPasswordLength),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [matchingPasswordsValidator()],
    },
  );

  /** A session is stored on this device but could not be checked (offline or server unavailable). BUG-014. */
  readonly sessionUnavailable = computed(() => this.authService.status() === 'unavailable');
  readonly retryingSession = signal(false);

  constructor() {
    this.authService.clearError();

    // When the stored session is restored (manual retry or the network coming back), continue to the destination.
    let wasUnavailable = this.authService.status() === 'unavailable';
    effect(() => {
      const status = this.authService.status();
      if (status === 'unavailable') {
        wasUnavailable = true;
      } else if (wasUnavailable && status === 'authenticated') {
        wasUnavailable = false;
        void this.goToDestination();
      }
    });
  }

  async retrySession(): Promise<void> {
    this.retryingSession.set(true);
    try {
      await this.authService.retryRestore();
    } finally {
      this.retryingSession.set(false);
    }
  }

  private async goToDestination(): Promise<void> {
    await this.router.navigateByUrl(
      this.authService.resolvePostAuthUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
      { replaceUrl: true },
    );
  }

  @SingleFlight()
  async submitLogin(): Promise<void> {
    this.loginSubmitted.set(true);
    this.authService.clearError();

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    try {
      await this.authService.login(this.loginForm.getRawValue());
      await this.router.navigateByUrl(
        this.authService.resolvePostAuthUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        { replaceUrl: true },
      );
    } catch {
      // El servicio de autenticacion ya expone el mensaje para el componente de feedback.
    }
  }

  @SingleFlight()
  async submitRegister(): Promise<void> {
    this.registerSubmitted.set(true);
    this.authService.clearError();

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formValue = this.registerForm.getRawValue();

    try {
      await this.authService.register({
        fullName: (formValue.fullName ?? '').trim(),
        email: formValue.email,
        password: formValue.password,
        phoneNumber: formValue.phoneNumber.trim() ? formValue.phoneNumber.trim() : null,
      });

      await this.router.navigateByUrl(
        this.authService.resolvePostAuthUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        { replaceUrl: true },
      );
    } catch {
      // El servicio de autenticacion ya expone el mensaje para el componente de feedback.
    }
  }

  openForgotPanel(): void {
    this.forgotForm.reset();
    this.forgotSubmitted.set(false);
    this.forgotError.set('');
    this.forgotSent.set(false);
    this.showForgotPanel.set(true);
  }

  closeForgotPanel(): void {
    this.showForgotPanel.set(false);
  }

  @SingleFlight()
  async submitForgot(): Promise<void> {
    this.forgotSubmitted.set(true);
    this.forgotError.set('');

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.forgotLoading.set(true);
    try {
      await firstValueFrom(this.authApiService.forgotPassword(this.forgotForm.getRawValue()));
      this.forgotSent.set(true);
    } catch (error) {
      this.forgotError.set(forgotPasswordErrorMessage(error));
    } finally {
      this.forgotLoading.set(false);
    }
  }

  showLoginError(controlName: 'email' | 'password', errorName: string): boolean {
    const control = this.loginForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.loginSubmitted());
  }

  showRegisterError(
    controlName: 'fullName' | 'email' | 'phoneNumber' | 'password' | 'confirmPassword',
    errorName: string,
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.registerSubmitted());
  }

  showForgotError(errorName: string): boolean {
    const control = this.forgotForm.controls.email;
    return control.hasError(errorName) && (control.touched || this.forgotSubmitted());
  }

  showRegisterPasswordMismatchError(): boolean {
    return (
      this.registerForm.hasError('passwordMismatch') &&
      (this.registerForm.controls.confirmPassword.touched || this.registerSubmitted())
    );
  }

  isMinPasswordLengthMet(): boolean {
    return this.registerForm.controls.password.value.length >= this.minimumPasswordLength;
  }

  isMaxPasswordLengthMet(): boolean {
    return this.registerForm.controls.password.value.length <= this.maximumPasswordLength;
  }

  toggleLoginPasswordVisibility(): void {
    this.isLoginPasswordVisible.update((current) => !current);
  }

  toggleRegisterPasswordVisibility(): void {
    this.isRegisterPasswordVisible.update((current) => !current);
  }

  toggleConfirmPasswordVisibility(): void {
    this.isConfirmPasswordVisible.update((current) => !current);
  }

  private buildTabQueryParams(): { returnUrl: string } | null {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl ? { returnUrl } : null;
  }
}

function matchingPasswordsValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value ?? '';
    const confirmPassword = group.get('confirmPassword')?.value ?? '';

    if (!confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

/** No response at all: no network, or something in between (a blocker, a restricted network, CORS) stopped it. */
export const FORGOT_NO_CONNECTION_MESSAGE =
  'No pudimos comunicarnos con el servidor. Revisa tu conexión a internet; si estás conectado, puede que un bloqueador o la red en la que estás esté impidiendo la conexión.';
export const FORGOT_SERVER_ERROR_MESSAGE = 'El servidor no pudo enviar el correo en este momento. Inténtalo de nuevo en unos minutos.';

/**
 * Launch with the own domain: «Ocurrió un error al enviar el correo» was the same for every failure. A request that
 * never got an answer (status 0, which is also how a CORS rejection looks) is told apart from an error of the server.
 */
export function forgotPasswordErrorMessage(error: unknown): string {
  if (isConnectivityError(error)) {
    return FORGOT_NO_CONNECTION_MESSAGE;
  }

  if (error instanceof HttpErrorResponse && error.status === 429) {
    return statusMessage(429)!;
  }

  if (error instanceof HttpErrorResponse && error.status >= 500) {
    return FORGOT_SERVER_ERROR_MESSAGE;
  }

  return getApiErrorMessage(error, 'No pudimos enviar el correo. Inténtalo de nuevo.');
}
