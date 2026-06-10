import { Directive, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';

const PULL_THRESHOLD_PX = 70;
const MAX_PULL_PX = 110;

/**
 * Adds a mobile "pull down to refresh" gesture to its host element.
 * Only reacts to touches that start while the page is scrolled to the top,
 * so it never fights with normal list scrolling.
 */
@Directive({
  selector: '[appPullToRefresh]',
  exportAs: 'pullToRefresh',
})
export class PullToRefreshDirective {
  @Input('appPullToRefreshDisabled') disabled = false;
  @Output() readonly appPullToRefresh = new EventEmitter<void>();

  readonly isPulling = signal(false);
  readonly isReady = signal(false);
  readonly pullDistance = signal(0);

  private readonly hasBrowserContext = typeof window !== 'undefined';
  private tracking = false;
  private startY = 0;

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (this.disabled || !this.hasBrowserContext || event.touches.length !== 1) {
      return;
    }

    if (window.scrollY > 0) {
      this.tracking = false;
      return;
    }

    this.tracking = true;
    this.startY = event.touches[0].clientY;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.tracking || event.touches.length !== 1) {
      return;
    }

    const delta = event.touches[0].clientY - this.startY;

    if (delta <= 0 || window.scrollY > 0) {
      this.resetPull();
      return;
    }

    const distance = Math.min(delta * 0.55, MAX_PULL_PX);
    this.isPulling.set(true);
    this.pullDistance.set(distance);
    this.isReady.set(distance >= PULL_THRESHOLD_PX);
  }

  @HostListener('touchend')
  onTouchEnd(): void {
    if (!this.tracking) {
      return;
    }

    this.tracking = false;

    if (this.isReady()) {
      this.appPullToRefresh.emit();
    }

    this.resetPull();
  }

  private resetPull(): void {
    this.tracking = false;
    this.isPulling.set(false);
    this.isReady.set(false);
    this.pullDistance.set(0);
  }
}
