import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppointmentResponse } from '../../../../core/models/appointment.models';
import { ROLE_NAMES } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { CustomerAppointmentsApiService } from '../../../../core/services/customer-appointments-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { getAppointmentStatusLabel } from '../../../../core/utils/appointment-labels.utils';
import { bogotaDateTimeFormat } from '../../../../core/utils/bogota-date.utils';

/** What the "next appointment" card shows. */
type NextAppointmentState = 'anonymous' | 'loading' | 'ready' | 'none' | 'error';

export interface BookableService {
  generalServiceId: string;
  name: string;
  /** How many professionals offer it: the most offered come first. */
  staffCount: number;
}

const MAX_SERVICES = 8;

/**
 * Entry point of "Reservar" (SONDA BUG-024): the customer's real next appointment and the services the active
 * professionals offer, instead of fixed placeholders.
 */
@Component({
  selector: 'app-booking-landing-page',
  imports: [RouterLink],
  templateUrl: './booking-landing-page.component.html',
  styleUrl: './booking-landing-page.component.scss',
})
export class BookingLandingPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly customerAppointmentsApi = inject(CustomerAppointmentsApiService);
  private readonly publicStaffApi = inject(PublicStaffApiService);
  private readonly dateTimeFormatter = bogotaDateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });

  /** Staff and admin manage appointments elsewhere; the card is for customers and visitors. */
  readonly showsNextAppointment = computed(
    () => !this.authService.isAuthenticated() || this.authService.hasRole(ROLE_NAMES.customer),
  );
  readonly nextState = signal<NextAppointmentState>('loading');
  readonly nextAppointment = signal<AppointmentResponse | null>(null);
  readonly services = signal<BookableService[]>([]);
  readonly servicesLoaded = signal(false);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadNextAppointment(), this.loadServices()]);
  }

  formatDateTime(value: string): string {
    const text = this.dateTimeFormatter.format(new Date(value));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  statusLabel(appointment: AppointmentResponse): string {
    return getAppointmentStatusLabel(appointment.status);
  }

  private async loadNextAppointment(): Promise<void> {
    await this.authService.ensureInitialized();
    if (!this.authService.isAuthenticated()) {
      this.nextState.set('anonymous');
      return;
    }

    if (!this.authService.hasRole(ROLE_NAMES.customer)) {
      return;
    }

    try {
      // Upcoming is ordered soonest first by the API: the first item is the next appointment.
      const page = await firstValueFrom(this.customerAppointmentsApi.list({ scope: 'Upcoming', page: 1, pageSize: 1 }));
      const next = page.items[0] ?? null;
      this.nextAppointment.set(next);
      this.nextState.set(next ? 'ready' : 'none');
    } catch {
      this.nextState.set('error');
    }
  }

  private async loadServices(): Promise<void> {
    try {
      const staff = await firstValueFrom(this.publicStaffApi.list());
      const byId = new Map<string, BookableService>();
      for (const member of staff) {
        for (const service of member.services) {
          const current = byId.get(service.generalServiceId);
          byId.set(service.generalServiceId, {
            generalServiceId: service.generalServiceId,
            name: service.name,
            staffCount: (current?.staffCount ?? 0) + 1,
          });
        }
      }

      this.services.set(
        [...byId.values()]
          .sort((a, b) => b.staffCount - a.staffCount || a.name.localeCompare(b.name, 'es'))
          .slice(0, MAX_SERVICES),
      );
    } catch {
      this.services.set([]);
    } finally {
      this.servicesLoaded.set(true);
    }
  }
}
