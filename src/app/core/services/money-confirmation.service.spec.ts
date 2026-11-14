import { TestBed } from '@angular/core/testing';

import { UNUSUAL_AMOUNT_THRESHOLD } from '../config/money-confirmation.config';
import { ConfirmModalService } from './confirm-modal.service';
import { MoneyConfirmationService, formatCop } from './money-confirmation.service';

/** Confirmation of money values before saving (user decision of 2026-11-13, from SONDA BUG-080). */
describe('MoneyConfirmationService', () => {
  function setup(threshold?: number) {
    TestBed.configureTestingModule({
      providers: threshold === undefined ? [] : [{ provide: UNUSUAL_AMOUNT_THRESHOLD, useValue: threshold }],
    });
    return { service: TestBed.inject(MoneyConfirmationService), modal: TestBed.inject(ConfirmModalService) };
  }

  it.each([
    [3_500_000, '$ 3.500.000'],
    [25_000, '$ 25.000'],
    [999, '$ 999'],
    [0, '$ 0'],
    [6_000_000_000, '$ 6.000.000.000'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatCop(amount)).toBe(expected);
  });

  it('asks «¿Registrar ingreso por $ 3.500.000?» with Confirmar / Volver a editar and resolves with the answer', async () => {
    const { service, modal } = setup();

    const answer = service.confirm({ action: 'Registrar ingreso', amount: 3_500_000 });
    const options = modal.state()!.options;

    expect(options.title).toBe('¿Registrar ingreso por $ 3.500.000?');
    expect(options.confirmLabel).toBe('Confirmar');
    expect(options.cancelLabel).toBe('Volver a editar');
    expect(options.warning).toBeUndefined();
    expect(options.danger).toBe(false);

    modal._resolve(true);
    await expect(answer).resolves.toBe(true);
  });

  it('adds a highlighted notice above 10.000.000 COP, without blocking', async () => {
    const { service, modal } = setup();

    const atThreshold = service.confirm({ action: 'Registrar gasto', amount: 10_000_000 });
    expect(modal.state()!.options.warning).toBeUndefined();
    modal._resolve(true);
    await atThreshold;

    const above = service.confirm({ action: 'Registrar gasto', amount: 10_000_001 });
    expect(modal.state()!.options.warning).toContain('inusualmente alto');
    expect(modal.state()!.options.warning).toContain('$ 10.000.000');
    modal._resolve(true);
    await expect(above).resolves.toBe(true);
  });

  it('uses the configured threshold', () => {
    const { service, modal } = setup(500_000);

    void service.confirm({ action: 'Crear la tarifa', amount: 600_000 });

    expect(modal.state()!.options.warning).toContain('$ 500.000');
  });

  it('«Volver a editar» resolves false', async () => {
    const { service, modal } = setup();

    const answer = service.confirm({ action: 'Vender la membresía', amount: 150_000 });
    modal._resolve(false);

    await expect(answer).resolves.toBe(false);
  });
});
