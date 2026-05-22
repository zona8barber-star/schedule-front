import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService, ToastTone } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss',
  host: { style: 'display:contents' },
})
export class ToastOutletComponent {
  readonly toastService = inject(ToastService);

  dismiss(toastId: number): void {
    this.toastService.dismiss(toastId);
  }

  toneLabel(tone: ToastTone): string {
    switch (tone) {
      case 'success':
        return 'Listo';
      case 'error':
        return 'Atencion';
      default:
        return 'Info';
    }
  }
}
