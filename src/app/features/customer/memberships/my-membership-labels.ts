import { MembershipDisplayStatus, MembershipGiftStatus } from '../../../core/models/membership.models';

export const MY_MEMBERSHIP_STATUS_LABELS: Record<MembershipDisplayStatus, string> = {
  PendingActivation: 'Pendiente de activación',
  Scheduled: 'Programada',
  Active: 'Vigente',
  Expired: 'Vencida',
  Annulled: 'Anulada',
};

export const MY_GIFT_STATUS_LABELS: Record<MembershipGiftStatus, string> = {
  Granted: 'Incluido en tu saldo',
  Blocked: 'Bloqueado por anulación',
  PendingDelivery: 'Pendiente de entrega',
  Delivered: 'Entregado',
  NotDeliverable: 'No entregable por anulación',
};

/** Whether the balances can be used now, and why not when they cannot. */
export function balanceAvailability(
  status: MembershipDisplayStatus,
  startsOn: string,
  endsOn: string,
): { usable: boolean; text: string } {
  switch (status) {
    case 'Active':
      return { usable: true, text: `Disponibles hasta el ${endsOn} (incluido).` };
    case 'Scheduled':
      return { usable: false, text: `Podrás usarlos desde el ${startsOn}.` };
    case 'PendingActivation':
      return { usable: false, text: 'Bloqueados hasta que la barbería active tu membresía.' };
    case 'Expired':
      return { usable: false, text: `La membresía venció el ${endsOn}; los saldos ya no se pueden usar.` };
    case 'Annulled':
      return { usable: false, text: 'Bloqueados: la membresía fue anulada.' };
  }
}
