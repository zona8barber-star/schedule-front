import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { RUNTIME_CONFIG_STORAGE_KEY, RuntimeConfigService } from './runtime-config.service';

const served = {
  apiBaseUrl: 'https://api.zona8.test/api/v1',
  appName: 'Zona 8',
  appUrl: 'https://zona8.test',
  assetsBaseUrl: 'https://zona8.test/assets',
  environmentName: 'Production',
};

/** SONDA BUG-065/BUG-045: opened without network the app must keep talking to the real API, not the placeholders. */
describe('RuntimeConfigService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('stores the configuration served by the site', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(served), { status: 200 }));

    await TestBed.inject(RuntimeConfigService).load();

    expect(JSON.parse(localStorage.getItem(RUNTIME_CONFIG_STORAGE_KEY)!)).toEqual(served);
  });

  it('without network, uses the last served configuration instead of the build placeholders', async () => {
    localStorage.setItem(RUNTIME_CONFIG_STORAGE_KEY, JSON.stringify(served));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const config = await TestBed.inject(RuntimeConfigService).load();

    expect(config.apiBaseUrl).toBe(served.apiBaseUrl);
  });

  it('with nothing stored, falls back to the build defaults', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const config = await TestBed.inject(RuntimeConfigService).load();

    expect(config.apiBaseUrl).toBe(environment.defaultApiBaseUrl);
  });

  it('ignores a stored value that is not a usable configuration', async () => {
    localStorage.setItem(RUNTIME_CONFIG_STORAGE_KEY, '{"apiBaseUrl":""}');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const config = await TestBed.inject(RuntimeConfigService).load();

    expect(config.apiBaseUrl).toBe(environment.defaultApiBaseUrl);
  });

  it('fetches the real configuration again when the network comes back', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(RuntimeConfigService);
    await service.load();

    fetchMock.mockImplementation(async () => new Response(JSON.stringify(served), { status: 200 }));
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(service.config().apiBaseUrl).toBe(served.apiBaseUrl));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
