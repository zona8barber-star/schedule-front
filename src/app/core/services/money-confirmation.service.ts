import { Injectable, inject } from '@angular/core';

import { UNUSUAL_AMOUNT_THRESHOLD } from '../config/money-confirmation.config';
import { ConfirmModalService } from './confirm-modal.service';

/** Pesos with a dot as thousands separator and no decimals: 3500000 → "$ 3.500.000". */
export function formatCop(amount: number): string {
  const digits = Math.round(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '-' : ''}$ ${digits}`;
}

export interface MoneyConfirmationRequest {
  /** What is being saved, as a verb phrase: «Registrar ingreso», «Guardar el precio del producto». */
  action: string;
  amount: number;
  /** Optional extra line (for example what the amount belongs to). */
  detail?: string;
}

/**
 * The one dialog that confirms every money value before it is saved (user decision of 2026-11-13, from SONDA BUG-080):
 * «¿Registrar ingreso por $ 3.500.000?» with «Confirmar» and «Volver a editar». Above the configured threshold it adds a
 * highlighted notice that the amount is unusually high, without blocking the save.
 */
@Injectable({ providedIn: 'root' })
export class MoneyConfirmationService {
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly threshold = inject(UNUSUAL_AMOUNT_THRESHOLD);

  confirm(request: MoneyConfirmationRequest): Promise<boolean> {
    const unusual = request.amount > this.threshold;
    return this.confirmModal.confirm({
      title: `¿${request.action} por ${formatCop(request.amount)}?`,
      message: request.detail,
      warning: unusual
        ? `Este valor es inusualmente alto (más de ${formatCop(this.threshold)}). Revisa que no sobren ceros antes de confirmar.`
        : undefined,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Volver a editar',
      danger: false,
      icon: 'money',
    });
  }
}
