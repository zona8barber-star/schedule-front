import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AppointmentResponse,
  CreateCustomerAppointmentRequest,
} from '../../../../core/models/appointment.models';
import {
  PublicStaffProfileResponse,
  PublicStaffServiceResponse,
} from '../../../../core/models/content.models';
import { MAX_PAGE_SIZE } from '../../../../core/models/paged-result.models';
import { CustomerAppointmentsApiService } from '../../../../core/services/customer-appointments-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { BOGOTA_TIME_ZONE, bogotaDateKey } from '../../../../core/utils/bogota-date.utils';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../shared/components/page-state/page-state.component';
import { whatsAppUrl } from '../../../../core/utils/whatsapp-link.utils';

@Component({
  selector: 'app-booking-confirm-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './booking-confirm-page.component.html',
  styleUrl: './booking-confirm-page.component.scss',
})
export class BookingConfirmPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerAppointmentsApiService = inject(CustomerAppointmentsApiService);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: BOGOTA_TIME_ZONE,
  });

  readonly staffProfileId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('staffProfileId'),
  );
  readonly startsAtUtc = signal<string | null>(this.route.snapshot.queryParamMap.get('startsAt'));
  /** General service being booked (ADR-0016 B3); its name and duration come from the profile. */
  readonly generalServiceId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('generalServiceId'),
  );
  /** Set once the booking exists: the page then shows it instead of offering to book again (SONDA BUG-043). */
  readonly bookedAppointmentId = signal<string | null>(this.route.snapshot.queryParamMap.get('appointmentId'));
  readonly isLoadingBooked = signal(false);
  readonly staffProfile = signal<PublicStaffProfileResponse | null>(null);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successAppointment = signal<AppointmentResponse | null>(null);
  /** The chosen time was taken by someone else while confirming (409). */
  readonly slotTaken = signal(false);

  readonly service = computed<PublicStaffServiceResponse | null>(
    () =>
      this.staffProfile()?.services.find(
        (service) => service.generalServiceId === this.generalServiceId(),
      ) ?? null,
  );

  readonly canSubmit = computed(() => {
    const staffProfileId = this.staffProfileId();
    const startsAtUtc = this.startsAtUtc();
    if (!staffProfileId || !startsAtUtc || !this.generalServiceId()) {
      return false;
    }

    return !Number.isNaN(Date.parse(startsAtUtc));
  });

  /** Back to the barber's booking modal, opened on the same day and service. */
  readonly changeDateQueryParams = computed(() => {
    const startsAtUtc = this.startsAtUtc();
    const valid = !!startsAtUtc && !Number.isNaN(Date.parse(startsAtUtc));
    const generalServiceId = this.generalServiceId();
    return {
      reservar: 1,
      ...(valid ? { fecha: bogotaDateKey(startsAtUtc) } : {}),
      ...(generalServiceId ? { servicio: generalServiceId } : {}),
    };
  });

  readonly submitLabel = computed(() =>
    this.isSubmitting() ? 'Confirmando...' : 'Confirmar reserva',
  );

  readonly whatsappUrl = computed<string | null>(() => {
    const appointment = this.successAppointment();
    const staff = this.staffProfile();
    if (!appointment || !staff?.phoneNumber) return null;

    const formattedDate = this.formatDateTime(appointment.startsAtUtc);
    return whatsAppUrl(staff.phoneNumber, `Hola ${staff.displayName}, tengo una cita el ${formattedDate}`);
  });

  async ngOnInit(): Promise<void> {
    const bookedAppointmentId = this.bookedAppointmentId();
    if (bookedAppointmentId) {
      await this.showBookedAppointment(bookedAppointmentId);
    }

    const staffProfileId = this.staffProfileId() ?? this.successAppointment()?.staffProfileId;
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
    this.slotTaken.set(false);

    if (!this.canSubmit() || this.isSubmitting()) {
      return;
    }

    const staffProfileId = this.staffProfileId();
    const startsAtUtc = this.startsAtUtc();
    const generalServiceId = this.generalServiceId();
    if (!staffProfileId || !startsAtUtc || !generalServiceId) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      const request: CreateCustomerAppointmentRequest = {
        staffProfileId,
        generalServiceId,
        startsAtUtc,
        notes: null,
      };

      this.showSuccess(await firstValueFrom(this.customerAppointmentsApiService.create(request)));
    } catch (error) {
      // The customer may already hold this very slot (a second tab, an old link): that is not "taken".
      const own = isHttpConflict(error) ? await this.findOwnBooking(staffProfileId, startsAtUtc) : null;
      if (own) {
        this.showSuccess(own);
      } else {
        this.slotTaken.set(isHttpConflict(error));
        this.errorMessage.set(getBookingErrorMessage(error));
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Shows the booking and replaces the URL with one that points to it: reloading or coming back to this page
   * shows the booking again instead of "Confirmar reserva" for a slot the customer already took (SONDA BUG-043).
   */
  private showSuccess(appointment: AppointmentResponse): void {
    this.successAppointment.set(appointment);
    this.bookedAppointmentId.set(appointment.id);
    void this.router
      .navigate(['/booking/confirm'], { queryParams: { appointmentId: appointment.id }, replaceUrl: true })
      .catch(() => undefined);
  }

  private async showBookedAppointment(appointmentId: string): Promise<void> {
    this.isLoadingBooked.set(true);
    try {
      this.successAppointment.set(await firstValueFrom(this.customerAppointmentsApiService.getById(appointmentId)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error, 'No pudimos cargar tu reserva. Revísala en «Mis citas».'));
    } finally {
      this.isLoadingBooked.set(false);
    }
  }

  /** An active upcoming appointment of this customer with this professional at this exact time, if any. */
  private async findOwnBooking(staffProfileId: string, startsAtUtc: string): Promise<AppointmentResponse | null> {
    try {
      const upcoming = await firstValueFrom(
        this.customerAppointmentsApiService.list({ scope: 'Upcoming', pageSize: MAX_PAGE_SIZE }),
      );
      const startsAt = Date.parse(startsAtUtc);
      return (
        upcoming.items.find(
          (appointment) =>
            appointment.staffProfileId === staffProfileId &&
            Date.parse(appointment.startsAtUtc) === startsAt &&
            (appointment.status === 'Pending' || appointment.status === 'Confirmed'),
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }
}

function getBookingErrorMessage(error: unknown): string {
  if (isHttpConflict(error)) {
    return 'Ese horario ya no está disponible o el servicio ya no se ofrece.';
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
