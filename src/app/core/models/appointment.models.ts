import { PageQuery } from './paged-result.models';

export const APPOINTMENT_STATUS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  noShow: 'NoShow',
} as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

export const APPOINTMENT_SOURCE = {
  customerBooking: 'CustomerBooking',
  manual: 'Manual',
} as const;

export type AppointmentSource = (typeof APPOINTMENT_SOURCE)[keyof typeof APPOINTMENT_SOURCE];

export interface CreateCustomerAppointmentRequest {
  staffProfileId: string;
  generalServiceId: string;
  startsAtUtc: string;
  notes?: string | null;
}

export interface RescheduleCustomerAppointmentRequest {
  startsAtUtc: string;
}

/** The professional cannot change the duration: it comes from their offering of the service. */
export interface StaffManualAppointmentCreateRequest {
  startsAtUtc: string;
  generalServiceId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface AdminManualAppointmentCreateRequest {
  staffProfileId: string;
  startsAtUtc: string;
  generalServiceId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  /** Admin-only override (10–240); omitted uses the offering's duration. */
  durationMinutes?: number | null;
}

/**
 * generalServiceId omitted/null keeps the current service; durationMinutes omitted keeps the reserved duration
 * (or the new offering's when the service changes). Only admin may send a different duration.
 */
export interface AppointmentUpdateRequest {
  startsAtUtc: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  generalServiceId?: string | null;
  durationMinutes?: number | null;
}

/** A bookable offering of a professional, for the manual appointment forms (ADR-0016 B3). */
export interface AppointmentServiceOption {
  generalServiceId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  durationMinutes: number;
}

export const APPOINTMENT_DURATION_RANGE = { min: 10, max: 240 } as const;

export interface AppointmentStatusUpdateRequest {
  status: AppointmentStatus;
}

export interface AppointmentReviewResponse {
  stars: number;
  comment: string | null;
}

export type AppointmentListSort = 'Asc' | 'Desc';

/** Filters of GET /admin/appointments (ADR-0016 B7); dates are inclusive Bogotá days of the start. */
export interface AdminAppointmentsListFilters extends PageQuery {
  from?: string | null;
  to?: string | null;
  staffProfileId?: string | null;
  /** One status or a comma-separated list (any of), e.g. "Pending,Confirmed". */
  status?: string | null;
  generalServiceId?: string | null;
  /** Part of the customer name, email or phone. */
  customer?: string | null;
  /** "Desc" (newest first, default) or "Asc" (soonest first). */
  sort?: AppointmentListSort | null;
  /** "Agenda" (from today on) or "History" (at most 30 days per query, the last 30 by default). */
  scope?: AppointmentListScope | null;
}

/**
 * "Agenda": today and later, any length (the work still to attend). "History": any period, at most 30 calendar days
 * per query; the API applies the last 30 days when no range is given.
 */
export type AppointmentListScope = 'Agenda' | 'History';

/** Filters of GET /staff/appointments: the professional's own agenda. */
export interface StaffAppointmentsListFilters extends PageQuery {
  from?: string | null;
  to?: string | null;
  /** One status or a comma-separated list (any of), e.g. "Pending,Confirmed". */
  status?: string | null;
  sort?: AppointmentListSort | null;
  scope?: AppointmentListScope | null;
}

/**
 * Filters of GET /customer/appointments. `Upcoming` = pending or confirmed and still in the future (soonest first);
 * `Past` = everything else (newest first).
 */
export type CustomerAppointmentScope = 'Upcoming' | 'Past';

export interface CustomerAppointmentsListFilters extends PageQuery {
  scope?: CustomerAppointmentScope | null;
  /** One status or a comma-separated list (any of), e.g. "Pending,Confirmed". */
  status?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface AppointmentResponse {
  id: string;
  staffProfileId: string;
  staffName: string | null;
  customerUserId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  /** Null on appointments created before booking by service (ADR-0016 B3). */
  generalServiceId?: string | null;
  generalServiceName?: string | null;
  reservedDurationMinutes?: number | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  review?: AppointmentReviewResponse | null;
}
