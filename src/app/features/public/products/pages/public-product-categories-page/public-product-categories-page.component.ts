import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicProductCategory } from '../../../../../core/models/product-catalog.models';
import { PublicProductCatalogApiService } from '../../../../../core/services/public-product-catalog-api.service';
import { PublicCatalogLoadState, loadStateForError } from '../../public-product-load-state';

/** Entry of the public product catalog, at the stable URL /productos (ADR-0016 B6). No login needed. */
@Component({
  selector: 'app-public-product-categories-page',
  imports: [RouterLink],
  templateUrl: './public-product-categories-page.component.html',
  styleUrl: '../../public-products.scss',
})
export class PublicProductCategoriesPageComponent implements OnInit {
  private readonly api = inject(PublicProductCatalogApiService);

  readonly state = signal<PublicCatalogLoadState>('loading');
  readonly categories = signal<PublicProductCategory[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.categories.set(await firstValueFrom(this.api.listCategories()));
      this.state.set('ready');
    } catch (error) {
      this.state.set(loadStateForError(error));
    }
  }
}
