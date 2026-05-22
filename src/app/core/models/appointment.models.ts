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
  startsAtUtc: string;
  notes?: string | null;
}

export interface StaffManualAppointmentCreateRequest {
  startsAtUtc: string;
  endsAtUtc?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface AdminManualAppointmentCreateRequest {
  staffProfileId: string;
  startsAtUtc: string;
  endsAtUtc?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface AppointmentUpdateRequest {
  startsAtUtc: string;
  endsAtUtc: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface AppointmentStatusUpdateRequest {
  status: AppointmentStatus;
}

export interface AppointmentReviewResponse {
  stars: number;
  comment: string | null;
}

export interface AdminAppointmentsListFilters {
  staffProfileId?: string;
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
  createdAtUtc: string;
  updatedAtUtc: string | null;
  review?: AppointmentReviewResponse | null;
}
