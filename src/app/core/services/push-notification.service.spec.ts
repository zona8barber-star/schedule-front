import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { signal } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthUserResponse } from '../models/auth.models';
import { AuthService } from './auth.service';
import { NotificationsApiService } from './notifications-api.service';
import { PushNotificationService } from './push-notification.service';

const SERVER_KEY = 'BAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKiss';
const OTHER_KEY = 'BP__________________________________________________________';

function keyBytes(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)).buffer;
}

function fakeSubscription(endpoint: string, serverKey = SERVER_KEY) {
  return {
    endpoint,
    options: { applicationServerKey: keyBytes(serverKey) },
    toJSON: () => ({ endpoint, keys: { p256dh: `p256-${endpoint}`, auth: `auth-${endpoint}` } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function user(id: string): AuthUserResponse {
  return {
    id,
    fullName: `User ${id}`,
    email: `${id}@example.com`,
    phoneNumber: null,
    roles: ['Customer'],
    profilePhotoId: null,
    profilePhotoUrl: null,
  } as AuthUserResponse;
}

describe('PushNotificationService', () => {
  let subscription$: BehaviorSubject<PushSubscription | null>;
  let swPush: {
    isEnabled: boolean;
    subscription: BehaviorSubject<PushSubscription | null>;
    pushSubscriptionChanges: Subject<{ oldSubscription: PushSubscription | null; newSubscription: PushSubscription | null }>;
    notificationClicks: Subject<{ action: string; notification: NotificationOptions & { title: string } }>;
    requestSubscription: ReturnType<typeof vi.fn>;
  };
  let api: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    getPushConfig: ReturnType<typeof vi.fn>;
  };
  let currentUser: ReturnType<typeof signal<AuthUserResponse | null>>;
  let logoutHooks: Array<() => Promise<void>>;
  let permission: NotificationPermission;

  beforeEach(() => {
    permission = 'granted';
    vi.stubGlobal('Notification', {
      get permission() {
        return permission;
      },
      requestPermission: vi.fn(async () => permission),
    });
    localStorage.clear();

    subscription$ = new BehaviorSubject<PushSubscription | null>(null);
    swPush = {
      isEnabled: true,
      subscription: subscription$,
      pushSubscriptionChanges: new Subject(),
      notificationClicks: new Subject(),
      requestSubscription: vi.fn(async ({ serverPublicKey }: { serverPublicKey: string }) => {
        const created = fakeSubscription('https://push.example/new', serverPublicKey);
        subscription$.next(created);
        return created;
      }),
    };

    api = {
      subscribe: vi.fn(() => of(undefined)),
      unsubscribe: vi.fn(() => of(undefined)),
      getPushConfig: vi.fn(() => of({ enabled: true, vapidPublicKey: SERVER_KEY })),
    };

    currentUser = signal<AuthUserResponse | null>(null);
    logoutHooks = [];

    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: swPush },
        { provide: NotificationsApiService, useValue: api },
        { provide: RuntimeConfigService, useValue: { config: () => ({ vapidPublicKey: OTHER_KEY }) } },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            isAuthenticated: () => currentUser() !== null,
            registerBeforeLogout: (hook: () => Promise<void>) => logoutHooks.push(hook),
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createService(): PushNotificationService {
    const service = TestBed.inject(PushNotificationService);
    TestBed.tick();
    return service;
  }

  function login(id: string): void {
    currentUser.set(user(id));
    TestBed.tick();
  }

  it('re-links an existing browser subscription to whoever logs in', async () => {
    subscription$.next(fakeSubscription('https://push.example/device'));
    createService();

    login('user-a');
    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalledTimes(1));
    expect(api.subscribe.mock.calls[0][0]).toMatchObject({ endpoint: 'https://push.example/device' });

    currentUser.set(null);
    TestBed.tick();
    login('user-b');
    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalledTimes(2));
    expect(api.subscribe.mock.calls[1][0]).toMatchObject({ endpoint: 'https://push.example/device' });
  });

  it('creates a subscription silently when permission was already granted', async () => {
    createService();
    login('user-a');

    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalled());
    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: SERVER_KEY });
  });

  it('replaces a subscription created with an old server key', async () => {
    const stale = fakeSubscription('https://push.example/stale', OTHER_KEY);
    subscription$.next(stale);
    createService();
    login('user-a');

    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalled());
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(api.subscribe.mock.calls.at(-1)?.[0]).toMatchObject({ endpoint: 'https://push.example/new' });
  });

  it('unlinks the device from the account before logout', async () => {
    subscription$.next(fakeSubscription('https://push.example/device'));
    createService();
    login('user-a');
    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalled());

    expect(logoutHooks).toHaveLength(1);
    await logoutHooks[0]();

    expect(api.unsubscribe).toHaveBeenCalledWith({ endpoint: 'https://push.example/device' });
  });

  it('does not re-subscribe after the user disabled notifications on this device', async () => {
    subscription$.next(fakeSubscription('https://push.example/device'));
    const service = createService();
    login('user-a');
    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalledTimes(1));

    await service.disable();
    subscription$.next(null);
    currentUser.set(null);
    TestBed.tick();
    login('user-a');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(swPush.requestSubscription).not.toHaveBeenCalled();
    expect(api.subscribe).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('disabled');
  });

  it('truncates very long user agents before sending them', async () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'x'.repeat(600) });
    createService();
    login('user-a');

    await vi.waitFor(() => expect(api.subscribe).toHaveBeenCalled());
    expect(api.subscribe.mock.calls[0][0].userAgent).toHaveLength(256);
  });

  it('only prompts users who have not been asked yet', async () => {
    permission = 'default';
    const service = createService();
    login('user-a');
    await vi.waitFor(() => expect(api.getPushConfig).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.shouldShowPrompt()).toBe(true);

    service.dismissPrompt();
    expect(service.shouldShowPrompt()).toBe(false);
  });
});
