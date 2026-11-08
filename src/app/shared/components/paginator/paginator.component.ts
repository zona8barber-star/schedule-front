import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { DEFAULT_PAGE_SIZE } from '../../../core/models/paged-result.models';

/**
 * Shared paginator of the server-side paginated lists (ADR-0016 B7). It only shows the current position and emits the
 * page (or page size) the user asks for; the page owns the state (usually in the URL) and reloads.
 */
@Component({
  selector: 'app-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  readonly page = input.required<number>();
  readonly pageSize = input<number>(DEFAULT_PAGE_SIZE);
  readonly totalCount = input.required<number>();
  /** Accessible name of the navigation landmark, e.g. "Paginación de ingresos". */
  readonly label = input('Paginación');
  /** Page sizes offered in the selector; an empty list hides it. */
  readonly pageSizeOptions = input<readonly number[]>([]);
  readonly disabled = input(false);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / Math.max(1, this.pageSize()))));
  readonly hasPrevious = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() < this.totalPages());
  readonly firstItem = computed(() => (this.totalCount() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  readonly lastItem = computed(() => Math.min(this.totalCount(), this.page() * this.pageSize()));

  goTo(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages());
    if (target !== this.page() && !this.disabled()) {
      this.pageChange.emit(target);
    }
  }

  onPageSizeChange(value: string): void {
    const size = Number(value);
    if (Number.isInteger(size) && size > 0 && size !== this.pageSize()) {
      this.pageSizeChange.emit(size);
    }
  }
}
