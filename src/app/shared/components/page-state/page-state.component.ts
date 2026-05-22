import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-state.component.html',
  styleUrl: './page-state.component.scss',
})
export class PageStateComponent {
  readonly kind = input<'loading' | 'empty'>('empty');
  readonly title = input<string | null>(null);
  readonly message = input.required<string>();
}
