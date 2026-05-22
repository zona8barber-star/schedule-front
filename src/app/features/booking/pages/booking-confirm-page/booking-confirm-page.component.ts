import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AppointmentResponse,
  CreateCustomerAppointmentRequest,
} from '../../../../core/models/appointment.models';
import { PublicStaffProfileResponse } from '../../../../core/models/content.models';
import { CustomerAppointmentsApiService } from '../../../../core/services/customer-appointments-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-booking-confirm-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './booking-confirm-page.component.html',
  styleUrl: './booking-confirm-page.component.scss',
})
export class BookingConfirmPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly customerAppointmentsApiService = inject(CustomerAppointmentsApiService);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  readonly staffProfileId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('staffProfileId'),
  );
  readonly startsAtUtc = signal<string | null>(this.route.snapshot.queryParamMap.get('startsAt'));
  readonly staffProfile = signal<PublicStaffProfileResponse | null>(null);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successAppointment = signal<AppointmentResponse | null>(null);

  readonly canSubmit = computed(() => {
    const staffProfileId = this.staffProfileId();
    const startsAtUtc = this.startsAtUtc();
    if (!staffProfileId || !startsAtUtc) {
      return false;
    }

    return !Number.isNaN(Date.parse(startsAtUtc));
  });

  readonly submitLabel = computed(() =>
    this.isSubmitting() ? 'Confirmando...' : 'Confirmar reserva',
  );

  readonly whatsappUrl = computed<string | null>(() => {
    const appointment = this.successAppointment();
    const staff = this.staffProfile();
    if (!appointment || !staff?.phoneNumber) return null;

    const phone = staff.phoneNumber.replace(/\D/g, '');
    if (!phone) return null;

    const formattedDate = this.formatDateTime(appointment.startsAtUtc);
    const message = `Hola ${staff.displayName}, tengo una cita el ${formattedDate}`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  });

  async ngOnInit(): Promise<void> {
    const staffProfileId = this.staffProfileId();
    if (!staffProfileId) return;

    try {
      this.staffProfile.set(
        await firstValueFrom(this.publicStaffApiService.getById(staffProfileId)),
      );
    } catch {
      // Staff profile is optional — booking can proceed without it
    }
  }

  async confirmBooking(): Promise<void> {
    this.errorMessage.set(null);

    if (!this.canSubmit() || this.isSubmitting()) {
      return;
    }

    const staffProfileId = this.staffProfileId();
    const startsAtUtc = this.startsAtUtc();
    if (!staffProfileId || !startsAtUtc) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      const request: CreateCustomerAppointmentRequest = {
        staffProfileId,
        startsAtUtc,
        notes: null,
      };

      this.successAppointment.set(
        await firstValueFrom(this.customerAppointmentsApiService.create(request)),
      );
    } catch (error) {
      this.errorMessage.set(getBookingErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }
}

function getBookingErrorMessage(error: unknown): string {
  if (isHttpConflict(error)) {
    return 'Ese horario ya no esta disponible. Selecciona otro turno.';
  }

  return getApiErrorMessage(error);
}

function isHttpConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    Number((error as { status?: unknown }).status) === 409
  );
}
