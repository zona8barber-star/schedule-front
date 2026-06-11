import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-photo-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-placeholder.component.html',
  styleUrl: './photo-placeholder.component.scss',
})
export class PhotoPlaceholderComponent {
  readonly label = input<string>('');
  readonly variant = input<'dark' | 'light'>('light');
}
