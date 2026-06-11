import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-ticker-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticker-strip.component.html',
  styleUrl: './ticker-strip.component.scss',
})
export class TickerStripComponent {
  readonly items = input.required<string[]>();
}
