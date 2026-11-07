import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicProduct, formatCop } from '../../../../../core/models/product-catalog.models';
import { PublicProductCatalogApiService } from '../../../../../core/services/public-product-catalog-api.service';
import { PublicCatalogLoadState, loadStateForError } from '../../public-product-load-state';

/**
 * /productos/:categoryCode/:productCode — detail and price of one product (ADR-0016 B6). The product is resolved by
 * its own immutable code only, so a link keeps working after the product moves to another category; the links on
 * this page always use its current category.
 */
@Component({
  selector: 'app-public-product-detail-page',
  imports: [RouterLink],
  templateUrl: './public-product-detail-page.component.html',
  styleUrl: '../../public-products.scss',
})
export class PublicProductDetailPageComponent {
  private readonly api = inject(PublicProductCatalogApiService);
  private readonly route = inject(ActivatedRoute);

  readonly formatPrice = formatCop;
  readonly state = signal<PublicCatalogLoadState>('loading');
  readonly product = signal<PublicProduct | null>(null);
  private productCode = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      this.productCode = params.get('productCode') ?? '';
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.state.set('loading');
    this.product.set(null);
    try {
      this.product.set(await firstValueFrom(this.api.getProduct(this.productCode)));
      this.state.set('ready');
    } catch (error) {
      this.state.set(loadStateForError(error));
    }
  }
}
