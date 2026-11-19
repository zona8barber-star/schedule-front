import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { NotificationHistoryResponse, UserNotificationItem } from '../../../../../core/models/notification.models';
import { NotificationCenterService } from '../../../../../core/services/notification-center.service';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { NOTIFICATION_HISTORY_PAGE_SIZE, NotificationHistoryPageComponent } from './notification-history-page.component';

/** ADR-0019 N5 (SONDA BUG-116): history of every notification, paginated, with the unread filter. */
describe('NotificationHistoryPageComponent', () => {
  let fixture: ComponentFixture<NotificationHistoryPageComponent>;
  let api: { getHistory: ReturnType<typeof vi.fn> };
  let center: { markAsRead: ReturnType<typeof vi.fn>; markAllAsRead: ReturnType<typeof vi.fn> };

  function item(id: string, readAtUtc: string | null, url: string | null = '/customer/loyalty'): UserNotificationItem {
    return {
      id,
      type: 'loyalty.points_earned',
      title: `Aviso ${id}`,
      body: 'Sumaste 10 puntos por tu servicio en la barbería.',
      url,
      createdAtUtc: '2026-11-15T15:00:00Z',
      readAtUtc,
    };
  }

  function page(items: UserNotificationItem[], totalCount = items.length, unreadCount = 1): NotificationHistoryResponse {
    return { items, page: 1, pageSize: NOTIFICATION_HISTORY_PAGE_SIZE, totalCount, unreadCount };
  }

  async function create(params: Record<string, string> = {}, response = page([item('1', null), item('2', '2026-11-15T16:00:00Z')])) {
    api = { getHistory: vi.fn(() => of(response)) };
    center = { markAsRead: vi.fn(async () => undefined), markAllAsRead: vi.fn(async () => undefined) };

    await TestBed.configureTestingModule({
      imports: [NotificationHistoryPageComponent],
      providers: [
        provideRouter([]),
        { provide: NotificationsApiService, useValue: api },
        { provide: NotificationCenterService, useValue: center },
        { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(convertToParamMap(params)) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationHistoryPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists read and unread notifications of the requested page', async () => {
    const element = await create({ page: '2' });

    expect(api.getHistory).toHaveBeenCalledWith(2, NOTIFICATION_HISTORY_PAGE_SIZE, false);
    const rows = element.querySelectorAll('[data-testid="history-item"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Sin leer');
    expect(rows[1].textContent).toContain('Leída');
    expect(element.querySelector('[data-testid="history-filter-unread"]')!.textContent).toContain('Sin leer (1)');
  });

  it('asks only for the unread ones with the filter in the URL', async () => {
    const element = await create({ filter: 'unread' });

    expect(api.getHistory).toHaveBeenCalledWith(1, NOTIFICATION_HISTORY_PAGE_SIZE, true);
    expect(element.querySelector('[data-testid="history-filter-unread"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('switching the filter goes back to the first page', async () => {
    const element = await create({ page: '3' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    element.querySelector<HTMLButtonElement>('[data-testid="history-filter-unread"]')!.click();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { filter: 'unread', page: null } }));
  });

  it('opening an unread notification marks it read through the bell and follows its link', async () => {
    const element = await create();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    element.querySelector<HTMLButtonElement>('[data-testid="history-item"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(center.markAsRead).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    expect(navigateByUrl).toHaveBeenCalledWith('/customer/loyalty');
  });

  it('«Marcar todas como leídas» goes through the bell and reloads', async () => {
    const element = await create();

    element.querySelector<HTMLButtonElement>('[data-testid="history-read-all"]')!.click();
    await fixture.whenStable();

    expect(center.markAllAsRead).toHaveBeenCalled();
    expect(api.getHistory).toHaveBeenCalledTimes(2);
  });

  // SONDA BUG-143: a server error is the common error state with «Reintentar», never «No tienes notificaciones todavía» nor «(0)».
  it('shows the error state with a retry instead of an empty history when the server fails', async () => {
    api = { getHistory: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))) };
    center = { markAsRead: vi.fn(async () => undefined), markAllAsRead: vi.fn(async () => undefined) };
    await TestBed.configureTestingModule({
      imports: [NotificationHistoryPageComponent],
      providers: [
        provideRouter([]),
        { provide: NotificationsApiService, useValue: api },
        { provide: NotificationCenterService, useValue: center },
        { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(convertToParamMap({})) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationHistoryPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();
    expect(element.textContent).not.toContain('No tienes notificaciones todavía');
    expect(element.querySelector('[data-testid="history-filter-unread"]')?.textContent?.trim()).toBe('Sin leer');

    api.getHistory.mockReturnValue(of(page([item('1', null)], 1, 62)));
    (element.querySelector('[data-testid="load-error-retry"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(element.querySelector('[data-testid="history-filter-unread"]')?.textContent?.trim()).toBe('Sin leer (62)');
  });

  it('shows an empty state for each filter', async () => {
    const element = await create({ filter: 'unread' }, page([], 0, 0));

    expect(element.textContent).toContain('No tienes notificaciones sin leer.');
    expect(element.querySelector('[data-testid="history-read-all"]')).toBeNull();
  });

  // SONDA BUG-144: a page past the end goes to the last page instead of «No tienes notificaciones todavía».
  it('goes to the last page when the requested one is past the end', async () => {
    await create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.page.set(5);
    api.getHistory.mockReturnValue(of(page([], 61, 3)));

    fixture.componentInstance.retryLoad();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: 4 } }));
  });

  // SONDA BUG-148: «Marcar todas como leídas» from the bell refreshes the open history.
  it('reloads when every notification is marked as read from the bell', async () => {
    const readAllVersion = signal(0);
    api = { getHistory: vi.fn(() => of(page([item('1', null)], 1, 1))) };
    await TestBed.configureTestingModule({
      imports: [NotificationHistoryPageComponent],
      providers: [
        provideRouter([]),
        { provide: NotificationsApiService, useValue: api },
        { provide: NotificationCenterService, useValue: { markAsRead: vi.fn(), markAllAsRead: vi.fn(), readAllVersion } },
        { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(convertToParamMap({})) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationHistoryPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const calls = api.getHistory.mock.calls.length;

    api.getHistory.mockReturnValue(of(page([item('1', '2026-11-18T10:00:00Z')], 1, 0)));
    readAllVersion.set(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getHistory.mock.calls.length).toBe(calls + 1);
    expect(fixture.componentInstance.unreadCount()).toBe(0);
  });

});
