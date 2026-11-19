import { HttpErrorResponse } from '@angular/common/http';

import { FORGOT_NO_CONNECTION_MESSAGE, FORGOT_SERVER_ERROR_MESSAGE, forgotPasswordErrorMessage } from './login-page.component';

/** Launch with the own domain: the password recovery tells a missing connection (or a block) from a server error. */
describe('forgotPasswordErrorMessage', () => {
  it('says there was no answer when the request never reached the server (no network, a blocker or CORS)', () => {
    expect(forgotPasswordErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe(FORGOT_NO_CONNECTION_MESSAGE);
  });

  it('says the server could not send the email on a 5xx', () => {
    expect(forgotPasswordErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe(FORGOT_SERVER_ERROR_MESSAGE);
    expect(forgotPasswordErrorMessage(new HttpErrorResponse({ status: 503 }))).toBe(FORGOT_SERVER_ERROR_MESSAGE);
  });

  it('explains the limit of attempts and keeps the API message otherwise', () => {
    expect(forgotPasswordErrorMessage(new HttpErrorResponse({ status: 429 }))).toContain('demasiadas solicitudes');
    expect(
      forgotPasswordErrorMessage(new HttpErrorResponse({ status: 422, error: { title: 'x', status: 422, errors: { email: ['El correo no es válido.'] } } })),
    ).toBe('El correo no es válido.');
  });
});
