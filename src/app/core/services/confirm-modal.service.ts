import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmModalState {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmModalService {
  private readonly _state = signal<ConfirmModalState | null>(null);

  readonly state = this._state.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._state.set({ options, resolve });
    });
  }

  /** Called by the modal component only. */
  _resolve(value: boolean): void {
    const current = this._state();
    if (!current) return;
    this._state.set(null);
    current.resolve(value);
  }
}
