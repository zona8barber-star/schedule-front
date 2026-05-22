import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  AppointmentResponse,
  CreateCustomerAppointmentRequest,
} from '../models/appointment.models';

@Injectable({
  providedIn: 'root',
})
export class CustomerAppointmentsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<AppointmentResponse[]>(this.buildUrl('/customer/appointments'));
  }

  getById(appointmentId: string) {
    return this.httpClient
      .get<AppointmentResponse>(this.buildUrl(`/customer/appointments/${appointmentId}`))
      .pipe(
        catchError((error: unknown) => {
          if (
            !(error instanceof HttpErrorResponse) ||
            (error.status !== 404 && error.status !== 405)
          ) {
            return throwError(() => error);
          }

          return this.list().pipe(
            map(
              (appointments) =>
                appointments.find((appointment) => appointment.id === appointmentId) ?? null,
            ),
            switchMap((appointment) => (appointment ? of(appointment) : throwError(() => error))),
          );
        }),
      );
  }

  create(request: CreateCustomerAppointmentRequest) {
    return this.httpClient.post<AppointmentResponse>(
      this.buildUrl('/customer/appointments'),
      request,
    );
  }

  cancel(appointmentId: string) {
    const cancelPath = this.buildUrl(`/customer/appointments/${appointmentId}/cancel`);

    return this.httpClient.patch<AppointmentResponse>(cancelPath, null).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 405) {
          return this.httpClient.post<AppointmentResponse>(cancelPath, null);
        }

        return throwError(() => error);
      }),
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
