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
}

export interface AvailabilityDayOption {
  dayOfWeek: number;
  key: string;
  label: string;
}

export const STAFF_AVAILABILITY_DAYS: AvailabilityDayOption[] = [
  { dayOfWeek: 0, key: 'sunday', label: 'Domingo' },
  { dayOfWeek: 1, key: 'monday', label: 'Lunes' },
  { dayOfWeek: 2, key: 'tuesday', label: 'Martes' },
  { dayOfWeek: 3, key: 'wednesday', label: 'Miercoles' },
  { dayOfWeek: 4, key: 'thursday', label: 'Jueves' },
  { dayOfWeek: 5, key: 'friday', label: 'Viernes' },
  { dayOfWeek: 6, key: 'saturday', label: 'Sabado' },
] as const;
