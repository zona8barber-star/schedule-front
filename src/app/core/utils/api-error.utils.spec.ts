import { HttpErrorResponse } from '@angular/common/http';

import { CONNECTIVITY_ERROR_MESSAGE, getApiErrorMessage, isConnectivityError, looksEnglish } from './api-error.utils';

/** SONDA BUG-045: the service worker answers 504 without network; that is not "not found" nor a generic failure. */
describe('isConnectivityError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('treats a request that never left the device (status 0) as no network', () => {
    expect(isConnectivityError(new HttpErrorResponse({ status: 0 }))).toBe(true);
  });

  it('treats the service worker 504 as no network only while the device is offline', () => {
    const gatewayTimeout = new HttpErrorResponse({ status: 504, statusText: 'Gateway Timeout' });

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isConnectivityError(gatewayTimeout)).toBe(true);
    expect(getApiErrorMessage(gatewayTimeout)).toBe(CONNECTIVITY_ERROR_MESSAGE);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(isConnectivityError(gatewayTimeout)).toBe(false);
  });

  it('does not take server answers or other errors for missing network', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    expect(isConnectivityError(new HttpErrorResponse({ status: 404 }))).toBe(false);
    expect(isConnectivityError(new Error('boom'))).toBe(false);
    expect(isConnectivityError(null)).toBe(false);
  });
});

/** SONDA BUG-007: whatever reaches the screen is Spanish, even when the server answered in English or without text. */
describe('getApiErrorMessage (Spanish fallback)', () => {
  const problem = (status: number, body: object | null) => new HttpErrorResponse({ status, error: body });

  it('keeps a Spanish message from the server', () => {
    expect(getApiErrorMessage(problem(409, { detail: 'Ya existe una cuenta con ese correo.' }))).toBe(
      'Ya existe una cuenta con ese correo.',
    );
  });

  it.each([
    [404, { title: 'Not Found' }, 'No encontramos lo que buscas. Es posible que ya no exista.'],
    [405, { title: 'Method Not Allowed' }, 'Esta acción no está permitida.'],
    [409, { detail: 'A user with this email already exists.' }, 'Los datos cambiaron mientras trabajabas. Recarga la página e inténtalo de nuevo.'],
    [422, { errors: { fullName: ['Full name must be between 2 and 120 characters.'] } }, 'Hay datos que no son válidos. Revisa los campos marcados.'],
    [429, { detail: 'You have made too many requests. Please wait a moment and try again.' }, 'Hiciste demasiadas solicitudes seguidas. Espera un momento y vuelve a intentarlo.'],
    [500, { detail: 'An unexpected error occurred while processing the request.' }, 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.'],
    [404, null, 'No encontramos lo que buscas. Es posible que ya no exista.'],
  ])('replaces an English or empty %s answer with a Spanish text', (status, body, expected) => {
    expect(getApiErrorMessage(problem(status, body))).toBe(expected);
  });

  it('prefers the fallback the screen asked for', () => {
    expect(getApiErrorMessage(problem(404, { title: 'Not Found' }), 'No encontramos el ingreso.')).toBe(
      'No encontramos el ingreso.',
    );
  });

  it('tells English from Spanish', () => {
    expect(looksEnglish('The income entry was not found.')).toBe(true);
    expect(looksEnglish('No encontramos el ingreso.')).toBe(false);
    expect(looksEnglish('Correo o contraseña incorrectos.')).toBe(false);
  });
});

describe('looksEnglish (Spanish without accents)', () => {
  it('does not take an unaccented Spanish message for English', () => {
    expect(looksEnglish('Hubo un error al guardar, intenta otra vez')).toBe(false);
  });
});
