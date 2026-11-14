import { TestBed } from '@angular/core/testing';

import { MAX_VISIBLE_TOASTS, ToastService } from './toast.service';

/** SONDA BUG-066: repeated failures must not pile up notices. */
describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('keeps a single notice for the same message, even with different spacing', () => {
    const first = service.error('No pudimos cargar la disponibilidad en este momento.');
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(service.error('  No pudimos cargar   la disponibilidad en este momento. ')).toBe(first);
    }

    expect(service.toasts()).toHaveLength(1);
  });

  it('restarts the timer of a repeated notice instead of adding another one', () => {
    service.error('Sin red', 2000);
    vi.advanceTimersByTime(1500);
    service.error('Sin red', 2000);
    vi.advanceTimersByTime(1500);

    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(service.toasts()).toHaveLength(0);
  });

  it(`never shows more than ${MAX_VISIBLE_TOASTS} notices; the oldest leaves first`, () => {
    ['uno', 'dos', 'tres', 'cuatro', 'cinco'].forEach((message) => service.error(message));

    expect(service.toasts().map((toast) => toast.message)).toEqual(['tres', 'cuatro', 'cinco']);
  });
});
