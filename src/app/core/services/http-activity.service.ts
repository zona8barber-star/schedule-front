import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HttpActivityService {
  private readonly activeRequestCount = signal(0);

  readonly isLoading = computed(() => this.activeRequestCount() > 0);

  begin(): void {
    this.activeRequestCount.update((currentCount) => currentCount + 1);
  }

  end(): void {
    this.activeRequestCount.update((currentCount) => Math.max(0, currentCount - 1));
  }
}
