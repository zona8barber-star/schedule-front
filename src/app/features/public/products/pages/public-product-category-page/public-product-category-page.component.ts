import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicProductCategoryDetail, formatCop } from '../../../../../core/models/product-catalog.models';
import { PublicProductCatalogApiService } from '../../../../../core/services/public-product-catalog-api.service';
import { PublicCatalogLoadState, loadStateForError } from '../../public-product-load-state';

/** /productos/:categoryCode — the active products of one category, with price and image (ADR-0016 B6). */
@Component({
  selector: 'app-public-product-category-page',
  imports: [RouterLink],
  templateUrl: './public-product-category-page.component.html',
  styleUrl: '../../public-products.scss',
})
export class PublicProductCategoryPageComponent {
  private readonly api = inject(PublicProductCatalogApiService);
  private readonly route = inject(ActivatedRoute);

  readonly formatPrice = formatCop;
  readonly state = signal<PublicCatalogLoadState>('loading');
  readonly category = signal<PublicProductCategoryDetail | null>(null);
  private categoryCode = '';

  constructor() {
    // The component is reused when moving between categories, so follow the parameter instead of a snapshot.
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      this.categoryCode = params.get('categoryCode') ?? '';
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.state.set('loading');
    this.category.set(null);
    try {
      this.category.set(await firstValueFrom(this.api.getCategory(this.categoryCode)));
      this.state.set('ready');
    } catch (error) {
      this.state.set(loadStateForError(error));
    }
  }
}
