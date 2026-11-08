import {
  APPOINTMENT_SOURCE,
  APPOINTMENT_STATUS,
  AppointmentResponse,
  AppointmentSource,
  AppointmentStatus,
} from '../models/appointment.models';

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  switch (status) {
    case APPOINTMENT_STATUS.pending:
      return 'Pendiente';
    case APPOINTMENT_STATUS.confirmed:
      return 'Confirmada';
    case APPOINTMENT_STATUS.completed:
      return 'Completada';
    case APPOINTMENT_STATUS.cancelled:
      return 'Cancelada';
    case APPOINTMENT_STATUS.noShow:
      return 'No-show';
    default:
      return status;
  }
}

export function getAppointmentSourceLabel(source: AppointmentSource): string {
  return source === APPOINTMENT_SOURCE.customerBooking ? 'Reserva online' : 'Manual';
}

type AppointmentTiming = Pick<AppointmentResponse, 'startsAtUtc' | 'endsAtUtc' | 'reservedDurationMinutes'>;

/** Reserved duration, or the span between start and end for appointments created before it was stored. */
export function getAppointmentDurationMinutes(appointment: AppointmentTiming): number {
  if (appointment.reservedDurationMinutes) {
    return appointment.reservedDurationMinutes;
  }

  const span = (Date.parse(appointment.endsAtUtc) - Date.parse(appointment.startsAtUtc)) / 60_000;
  return Number.isFinite(span) && span > 0 ? Math.round(span) : 0;
}

/** "Corte · 30 min", or null for appointments booked without a service (ADR-0016 B3). */
export function getAppointmentServiceLabel(
  appointment: Pick<AppointmentResponse, 'generalServiceName'> & AppointmentTiming,
): string | null {
  if (!appointment.generalServiceName) {
    return null;
  }

  const minutes = getAppointmentDurationMinutes(appointment);
  return minutes ? `${appointment.generalServiceName} · ${minutes} min` : appointment.generalServiceName;
}
