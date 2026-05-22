import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-scaffold-section',
  templateUrl: './scaffold-section.component.html',
  styleUrl: './scaffold-section.component.scss',
})
export class ScaffoldSectionComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title =
    (this.route.snapshot.data['title'] as string | undefined) ?? 'Seccion disponible';
  readonly description =
    (this.route.snapshot.data['description'] as string | undefined) ??
    'Este espacio estara disponible proximamente.';
}
