import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthResponse, CurrentUserResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  register(request: RegisterRequest) {
    return this.httpClient.post<AuthResponse>(this.buildUrl('/auth/register'), request, {
      withCredentials: true,
    });
  }

  login(request: LoginRequest) {
    return this.httpClient.post<AuthResponse>(this.buildUrl('/auth/login'), request, {
      withCredentials: true,
    });
  }

  // El refresh token va en la cookie HttpOnly (browsers estándar) y opcionalmente
  // en el body como fallback para iOS standalone donde ITP puede bloquear la cookie.
  refresh(refreshToken?: string | null) {
    const body = refreshToken ? { refreshToken } : {};
    return this.httpClient.post<AuthResponse>(this.buildUrl('/auth/refresh'), body, {
      withCredentials: true,
    });
  }

  // Refresh token is read from the HttpOnly cookie server-side — no body needed.
  logout() {
    return this.httpClient.post<void>(this.buildUrl('/auth/logout'), {}, {
      withCredentials: true,
    });
  }

  me() {
    return this.httpClient.get<CurrentUserResponse>(this.buildUrl('/auth/me'));
  }

  forgotPassword(request: ForgotPasswordRequest) {
    return this.httpClient.post<void>(this.buildUrl('/auth/forgot-password'), request);
  }

  resetPassword(request: ResetPasswordRequest) {
    return this.httpClient.post<void>(this.buildUrl('/auth/reset-password'), request);
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
