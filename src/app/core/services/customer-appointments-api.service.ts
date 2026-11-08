import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  AppointmentResponse,
  CreateCustomerAppointmentRequest,
  CustomerAppointmentsListFilters,
  RescheduleCustomerAppointmentRequest,
} from '../models/appointment.models';
import { MAX_PAGE_SIZE, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

@Injectable({
  providedIn: 'root',
})
export class CustomerAppointmentsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** The customer's own appointments, paginated (ADR-0016 B7). */
  list(filters: CustomerAppointmentsListFilters = {}) {
    const params = toHttpParams({
      scope: filters.scope,
      status: filters.status,
      from: filters.from,
      to: filters.to,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    return this.httpClient.get<PagedResult<AppointmentResponse>>(this.buildUrl('/customer/appointments'), { params });
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

          return this.list({ pageSize: MAX_PAGE_SIZE }).pipe(
            map(
              (page) =>
                page.items.find((appointment) => appointment.id === appointmentId) ?? null,
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

  /** Moves the appointment to another free slot with the same barber. */
  reschedule(appointmentId: string, request: RescheduleCustomerAppointmentRequest) {
    return this.httpClient.patch<AppointmentResponse>(
      this.buildUrl(`/customer/appointments/${appointmentId}/reschedule`),
      request,
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
