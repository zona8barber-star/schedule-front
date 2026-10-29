import {
  MembershipDisplayStatus,
  MembershipEventType,
  MembershipGiftStatus,
} from '../../../core/models/membership.models';

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipDisplayStatus, string> = {
  PendingActivation: 'Pendiente de activación',
  Scheduled: 'Programada',
  Active: 'Vigente',
  Expired: 'Vencida',
  Annulled: 'Anulada',
};

export const MEMBERSHIP_GIFT_STATUS_LABELS: Record<MembershipGiftStatus, string> = {
  Granted: 'Otorgado',
  Blocked: 'Bloqueado por anulación',
  PendingDelivery: 'Pendiente de entrega',
  NotDeliverable: 'No entregable por anulación',
};

export const MEMBERSHIP_EVENT_LABELS: Record<MembershipEventType, string> = {
  Sold: 'Venta registrada',
  Activated: 'Activada',
  ActivatedAfterExpiry: 'Activada después del vencimiento (excepcional)',
  IncomeLinked: 'Ingreso vinculado',
  IncomeUnlinked: 'Ingreso desvinculado',
  MovedByMerge: 'Trasladada por fusión de clientes',
  Annulled: 'Anulada',
};

/** Today in Bogotá as YYYY-MM-DD, the business date used for sales and validity. */
export function bogotaToday(now: Date = new Date()): string {
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return bogota.toISOString().slice(0, 10);
}

/** Inclusive end date: a 30-day membership starting on the 1st ends on the 30th. */
export function defaultEndsOn(startsOn: string, durationDays: number): string {
  const [year, month, day] = startsOn.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + durationDays - 1));
  return end.toISOString().slice(0, 10);
}
