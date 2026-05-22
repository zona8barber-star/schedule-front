import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-api-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './api-feedback.component.html',
  styleUrl: './api-feedback.component.scss',
  host: {
    '[style.display]': 'message() ? "block" : "none"',
  },
})
export class ApiFeedbackComponent {
  readonly severity = input<'error' | 'info'>('info');
  readonly message = input<string | null>(null);
  readonly details = input<string | null>(null);
}
