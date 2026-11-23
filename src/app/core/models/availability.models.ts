export interface AvailabilityRule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface AvailabilityRuleUpsertRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface UnavailablePeriod {
  id: string;
  startsAtUtc: string;
  endsAtUtc: string;
  reason: string | null;
  createdAtUtc: string;
}

export interface CreateUnavailablePeriodRequest {
  startsAtUtc: string;
  endsAtUtc: string;
  reason: string | null;
}

export interface UpdateUnavailablePeriodRequest {
  startsAtUtc: string;
  endsAtUtc: string;
  reason: string | null;
}

export interface AvailabilitySummary {
  staffProfileId: string;
  defaultAppointmentDurationMinutes: number;
  rules: AvailabilityRule[];
  unavailablePeriods: UnavailablePeriod[];
}

export interface PublicAvailabilitySlotResponse {
  startAtUtc: string;
  endAtUtc: string;
}

export interface PublicAvailabilitySlotsResponse {
  staffProfileId: string;
  from: string;
  to: string;
  slotDurationMinutes: number;
  slots: PublicAvailabilitySlotResponse[];
  generalServiceId?: string | null;
  /**
   * ADR-0022: equal to `slotDurationMinutes`. It is the nominal step: after an appointment or a block the next start is
   * when it ends, so consecutive slots never overlap but are not always exactly this far apart.
   */
  slotStepMinutes?: number;
}

/**
 * What the slots are computed for: a general service the professional offers, or the customer's own appointment
 * being rescheduled (its reserved duration, without the appointment itself among the occupied times: ADR-0022 P5).
 */
export type PublicAvailabilitySlotsQuery = { generalServiceId: string } | { rescheduleAppointmentId: string };

export interface AvailabilityDayOption {
  dayOfWeek: number;
  key: string;
  label: string;
}

export const STAFF_AVAILABILITY_DAYS: AvailabilityDayOption[] = [
  { dayOfWeek: 0, key: 'sunday', label: 'Domingo' },
  { dayOfWeek: 1, key: 'monday', label: 'Lunes' },
  { dayOfWeek: 2, key: 'tuesday', label: 'Martes' },
  { dayOfWeek: 3, key: 'wednesday', label: 'Miércoles' },
  { dayOfWeek: 4, key: 'thursday', label: 'Jueves' },
  { dayOfWeek: 5, key: 'friday', label: 'Viernes' },
  { dayOfWeek: 6, key: 'saturday', label: 'Sábado' },
] as const;
