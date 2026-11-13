import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  APPOINTMENT_STATUS,
  AppointmentResponse,
  AppointmentServiceOption,
  AppointmentStatus,
  AppointmentStatusUpdateRequest,
  AppointmentUpdateRequest,
  StaffAppointmentsListFilters,
  StaffManualAppointmentCreateRequest,
} from '../models/appointment.models';
import { MAX_PAGE_SIZE, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

@Injectable({
  providedIn: 'root',
})
export class StaffAppointmentsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** The professional's own agenda, paginated (ADR-0016 B7). */
  list(filters: StaffAppointmentsListFilters = {}) {
    const params = toHttpParams({
      from: filters.from,
      to: filters.to,
      status: filters.status,
      sort: filters.sort,
      scope: filters.scope,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    return this.httpClient.get<PagedResult<AppointmentResponse>>(this.buildUrl('/staff/appointments'), { params });
  }

  getById(appointmentId: string) {
    return this.httpClient
      .get<AppointmentResponse>(this.buildUrl(`/staff/appointments/${appointmentId}`))
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

  /** Bookable offerings of the current professional (ADR-0016 B3). */
  serviceOptions() {
    return this.httpClient.get<AppointmentServiceOption[]>(this.buildUrl('/staff/appointments/service-options'));
  }

  createManual(request: StaffManualAppointmentCreateRequest) {
    return this.httpClient.post<AppointmentResponse>(this.buildUrl('/staff/appointments'), request);
  }

  update(appointmentId: string, request: AppointmentUpdateRequest) {
    return this.httpClient.put<AppointmentResponse>(
      this.buildUrl(`/staff/appointments/${appointmentId}`),
      request,
    );
  }

  /** Pending → Confirmed (the customer is notified by the API). SONDA BUG-028. */
  confirm(appointmentId: string) {
    return this.updateStatus(appointmentId, APPOINTMENT_STATUS.confirmed, 'confirm');
  }

  markCompleted(appointmentId: string) {
    return this.updateStatus(appointmentId, APPOINTMENT_STATUS.completed, 'complete');
  }

  cancel(appointmentId: string) {
    return this.updateStatus(appointmentId, APPOINTMENT_STATUS.cancelled, 'cancel');
  }

  markNoShow(appointmentId: string) {
    return this.updateStatus(appointmentId, APPOINTMENT_STATUS.noShow, 'no-show');
  }

  private updateStatus(appointmentId: string, status: AppointmentStatus, legacyActionPath: string) {
    const request: AppointmentStatusUpdateRequest = { status };
    const statusPath = this.buildUrl(`/staff/appointments/${appointmentId}/status`);

    return this.httpClient.patch<AppointmentResponse>(statusPath, request).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 405)) {
          return this.callLegacyStatusEndpoint(appointmentId, legacyActionPath);
        }

        return throwError(() => error);
      }),
    );
  }

  private callLegacyStatusEndpoint(appointmentId: string, actionPath: string) {
    const legacyPath = this.buildUrl(`/staff/appointments/${appointmentId}/${actionPath}`);

    return this.httpClient.patch<AppointmentResponse>(legacyPath, null).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 405) {
          return this.httpClient.post<AppointmentResponse>(legacyPath, null);
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
