import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NotificationCenterService } from '../../services/notification-center.service';
import { NotificationBellComponent } from './notification-bell.component';

// SONDA BUG-149: closing the panel with «Escape» returns the focus to the bell, not to the top bar.
describe('NotificationBellComponent', () => {
  it('gives the focus back to the bell when the panel is closed with Escape', async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        {
          provide: NotificationCenterService,
          useValue: {
            items: signal([]),
            unreadCount: signal(0),
            isLoading: signal(false),
            hasLoaded: signal(true),
            hasMore: signal(false),
            isLoadingMore: signal(false),
            refresh: vi.fn(async () => undefined),
            loadMore: vi.fn(),
            markAsRead: vi.fn(),
            markAllAsRead: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotificationBellComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const bell = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="notification-bell"]') as HTMLButtonElement;

    fixture.componentInstance.toggle();
    fixture.detectChanges();
    (document.body as HTMLElement).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(document.activeElement).toBe(bell);
    fixture.nativeElement.remove();
  });
});
