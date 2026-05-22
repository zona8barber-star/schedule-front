import {
  APPOINTMENT_SOURCE,
  APPOINTMENT_STATUS,
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
