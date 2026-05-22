import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  APPOINTMENT_STATUS,
  AdminAppointmentsListFilters,
  AdminManualAppointmentCreateRequest,
  AppointmentResponse,
  AppointmentStatus,
  AppointmentStatusUpdateRequest,
  AppointmentUpdateRequest,
} from '../models/appointment.models';

@Injectable({
  providedIn: 'root',
})
export class AdminAppointmentsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list(filters?: AdminAppointmentsListFilters) {
    const params = filters?.staffProfileId
      ? new HttpParams({ fromObject: { staffProfileId: filters.staffProfileId } })
      : undefined;

    return this.httpClient.get<AppointmentResponse[]>(this.buildUrl('/admin/appointments'), {
      params,
    });
  }

  getById(appointmentId: string) {
    return this.httpClient
      .get<AppointmentResponse>(this.buildUrl(`/admin/appointments/${appointmentId}`))
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

  createManual(request: AdminManualAppointmentCreateRequest) {
    return this.httpClient.post<AppointmentResponse>(this.buildUrl('/admin/appointments'), request);
  }

  update(appointmentId: string, request: AppointmentUpdateRequest) {
    return this.httpClient.put<AppointmentResponse>(
      this.buildUrl(`/admin/appointments/${appointmentId}`),
      request,
    );
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
    const statusPath = this.buildUrl(`/admin/appointments/${appointmentId}/status`);

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
    const legacyPath = this.buildUrl(`/admin/appointments/${appointmentId}/${actionPath}`);

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
