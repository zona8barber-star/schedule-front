import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

/** At most this many notices at once (SONDA BUG-066). */
export const MAX_VISIBLE_TOASTS = 3;

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastsState = signal<ToastMessage[]>([]);
  private readonly timeoutHandles = new Map<number, ReturnType<typeof setTimeout>>();
  private nextToastId = 1;

  readonly toasts = this.toastsState.asReadonly();

  success(message: string, durationMs = 4200): number {
    return this.show('success', message, durationMs);
  }

  error(message: string, durationMs = 6200): number {
    return this.show('error', message, durationMs);
  }

  info(message: string, durationMs = 4600): number {
    return this.show('info', message, durationMs);
  }

  dismiss(toastId: number): void {
    this.clearTimer(toastId);
    this.toastsState.update((currentToasts) =>
      currentToasts.filter((currentToast) => currentToast.id !== toastId),
    );
  }

  private show(tone: ToastTone, message: string, durationMs: number): number {
    const normalizedMessage = message.replace(/\s+/g, ' ').trim();
    if (!normalizedMessage) {
      return -1;
    }

    const existingToast = this.toastsState().find(
      (currentToast) => currentToast.tone === tone && currentToast.message === normalizedMessage,
    );

    if (existingToast) {
      this.restartTimer(existingToast.id, durationMs);
      return existingToast.id;
    }

    const toastId = this.nextToastId;
    this.nextToastId += 1;

    // SONDA BUG-066: never a pile of notices; past the limit the oldest one leaves.
    const overflow = this.toastsState().slice(0, Math.max(0, this.toastsState().length - MAX_VISIBLE_TOASTS + 1));
    overflow.forEach((oldToast) => this.clearTimer(oldToast.id));

    this.toastsState.update((currentToasts) => [
      ...currentToasts.slice(overflow.length),
      {
        id: toastId,
        tone,
        message: normalizedMessage,
      },
    ]);

    this.restartTimer(toastId, durationMs);
    return toastId;
  }

  private restartTimer(toastId: number, durationMs: number): void {
    this.clearTimer(toastId);

    const safeDurationMs = Math.max(1200, durationMs);
    const timeoutHandle = setTimeout(() => {
      this.dismiss(toastId);
    }, safeDurationMs);

    this.timeoutHandles.set(toastId, timeoutHandle);
  }

  private clearTimer(toastId: number): void {
    const existingHandle = this.timeoutHandles.get(toastId);
    if (!existingHandle) {
      return;
    }

    clearTimeout(existingHandle);
    this.timeoutHandles.delete(toastId);
  }
}
