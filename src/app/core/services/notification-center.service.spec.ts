import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Subject, of, throwError } from 'rxjs';

import { AuthUserResponse } from '../models/auth.models';
import { NotificationInboxResponse, UserNotificationItem } from '../models/notification.models';
import { AuthService } from './auth.service';
import {
  NOTIFICATION_INBOX_LIMIT,
  NOTIFICATION_INBOX_MAX_LIMIT,
  NotificationCenterService,
} from './notification-center.service';
import { NotificationsApiService } from './notifications-api.service';

function item(id: string, read = false): UserNotificationItem {
  return {
    id,
    type: 'appointment.created',
    title: `Aviso ${id}`,
    body: 'Cuerpo',
    url: '/staff/appointments',
    createdAtUtc: '2026-10-07T15:00:00Z',
    readAtUtc: read ? '2026-10-07T15:05:00Z' : null,
  };
}

describe('NotificationCenterService', () => {
  let currentUser: ReturnType<typeof signal<AuthUserResponse | null>>;
  let messages: Subject<object>;
  let api: {
    getInbox: ReturnType<typeof vi.fn>;
    markNotificationAsRead: ReturnType<typeof vi.fn>;
    markAllNotificationsAsRead: ReturnType<typeof vi.fn>;
  };
  let inbox: NotificationInboxResponse;

  beforeEach(() => {
    inbox = { unreadCount: 2, items: [item('a'), item('b'), item('c', true)] };
    currentUser = signal<AuthUserResponse | null>(null);
    messages = new Subject<object>();
    api = {
      getInbox: vi.fn(() => of(inbox)),
      markNotificationAsRead: vi.fn(() => of(undefined)),
      markAllNotificationsAsRead: vi.fn(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsApiService, useValue: api },
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: SwPush,
          useValue: { isEnabled: true, messages, notificationClicks: new Subject() },
        },
      ],
    });
  });

  function createAndLogin(): NotificationCenterService {
    const service = TestBed.inject(NotificationCenterService);
    currentUser.set({ id: 'user-1' } as AuthUserResponse);
    TestBed.tick();
    return service;
  }

  it('loads the latest notifications and unread count when the user logs in', async () => {
    const service = createAndLogin();

    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));
    expect(api.getInbox).toHaveBeenCalledWith(NOTIFICATION_INBOX_LIMIT);
    expect(service.unreadCount()).toBe(2);
    expect(service.items()).toHaveLength(3);
  });

  it('refreshes when a push arrives while the app is open', async () => {
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));

    inbox = { unreadCount: 3, items: [item('d'), ...inbox.items] };
    messages.next({ notification: { title: 'Nueva cita' } });

    await vi.waitFor(() => expect(service.unreadCount()).toBe(3));
    expect(api.getInbox).toHaveBeenCalledTimes(2);
  });

  it('marks one notification as read optimistically', async () => {
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));

    await service.markAsRead(service.items()[0]);

    expect(api.markNotificationAsRead).toHaveBeenCalledWith('a');
    expect(service.unreadCount()).toBe(1);
    expect(service.items()[0].readAtUtc).not.toBeNull();
  });

  it('marks all as read and reloads from the server if the call fails', async () => {
    api.markAllNotificationsAsRead.mockReturnValue(throwError(() => new Error('offline')));
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));

    await service.markAllAsRead();

    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
    await vi.waitFor(() => expect(api.getInbox).toHaveBeenCalledTimes(2));
    expect(service.unreadCount()).toBe(2);
  });

  // BUG-107: el contador cuenta todas las sin leer; «Ver más» deja llegar a las que no caben en la primera página.
  it('offers «Ver más» while the server has more and widens the list from the start', async () => {
    inbox = { unreadCount: 7, items: [1, 2, 3, 4, 5].map((n) => item(`n${n}`)), hasMore: true };
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));
    expect(service.hasMore()).toBe(true);

    inbox = { unreadCount: 7, items: [1, 2, 3, 4, 5, 6, 7].map((n) => item(`n${n}`)), hasMore: false };
    await service.loadMore();

    expect(api.getInbox).toHaveBeenLastCalledWith(NOTIFICATION_INBOX_LIMIT * 2);
    expect(service.items().map((entry) => entry.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7']);
    expect(service.hasMore()).toBe(false);

    // Without more pages, «Ver más» does nothing.
    await service.loadMore();
    expect(api.getInbox).toHaveBeenCalledTimes(2);
  });

  it('goes back to the first page when the panel asks for it', async () => {
    inbox = { unreadCount: 7, items: [1, 2, 3, 4, 5].map((n) => item(`n${n}`)), hasMore: true };
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));
    await service.loadMore();

    await service.refresh({ firstPage: true });

    expect(api.getInbox).toHaveBeenLastCalledWith(NOTIFICATION_INBOX_LIMIT);
  });

  it('past the API maximum, continues by offset without repeating notifications', async () => {
    const firstFifty = Array.from({ length: NOTIFICATION_INBOX_MAX_LIMIT }, (_, index) => item(`p${index}`));
    inbox = { unreadCount: 60, items: firstFifty, hasMore: true };
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));
    for (let step = 0; step < 10 && api.getInbox.mock.lastCall?.[0] !== NOTIFICATION_INBOX_MAX_LIMIT; step++) {
      await service.loadMore();
    }

    api.getInbox.mockReturnValueOnce(
      of({ unreadCount: 60, items: [item('p49'), item('p50'), item('p51')], hasMore: false }),
    );
    await service.loadMore();

    expect(api.getInbox).toHaveBeenLastCalledWith(NOTIFICATION_INBOX_LIMIT, NOTIFICATION_INBOX_MAX_LIMIT);
    expect(service.items()).toHaveLength(NOTIFICATION_INBOX_MAX_LIMIT + 2);
    expect(service.hasMore()).toBe(false);
  });

  it('clears everything on logout', async () => {
    const service = createAndLogin();
    await vi.waitFor(() => expect(service.hasLoaded()).toBe(true));

    currentUser.set(null);
    TestBed.tick();

    expect(service.items()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });
});
