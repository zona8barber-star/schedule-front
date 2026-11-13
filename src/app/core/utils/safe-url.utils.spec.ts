import { FormControl } from '@angular/forms';

import {
  googleMapsUrlValidator,
  httpUrlValidator,
  isGoogleMapsUrl,
  safeGoogleMapsUrl,
  safeHttpUrl,
} from './safe-url.utils';

/** SONDA BUG-047: only http/https links are shown or sent, the same rule the API applies. */
describe('safe-url utils', () => {
  describe('safeHttpUrl', () => {
    it.each([
      ['https://instagram.com/zona8', 'https://instagram.com/zona8'],
      ['  http://facebook.com/zona8  ', 'http://facebook.com/zona8'],
      ['HTTPS://Example.com/Promo', 'https://example.com/Promo'],
    ])('%s → %s', (input, expected) => {
      expect(safeHttpUrl(input)).toBe(expected);
    });

    it.each([
      null,
      undefined,
      '',
      'javascript:alert(document.domain)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'instagram.com/tu_usuario',
      '/staff',
      '//evil.example.com',
      'https://user:secret@example.com/',
      'ftp://example.com/file',
    ])('returns null for an unsafe or incomplete link (%s)', (input) => {
      expect(safeHttpUrl(input)).toBeNull();
    });
  });

  describe('isGoogleMapsUrl', () => {
    it.each([
      'https://maps.app.goo.gl/AbCdEf123',
      'https://goo.gl/maps/AbCdEf123',
      'https://www.google.com/maps/place/Zona+8',
      'https://www.google.com/maps/embed?pb=!1m18',
      'https://maps.google.com/?q=Calle+123',
      'https://www.google.com.co/maps/place/Zona+8',
    ])('accepts %s', (input) => {
      expect(isGoogleMapsUrl(input)).toBe(true);
    });

    it.each([
      'javascript:alert(1)',
      'data:text/html,x',
      'http://maps.google.com/?q=1',
      'https://evil.example.com/maps',
      'https://www.google.com/search?q=barberia',
      'https://google.com.evil.example/maps',
    ])('rejects %s', (input) => {
      expect(isGoogleMapsUrl(input)).toBe(false);
      expect(safeGoogleMapsUrl(input)).toBeNull();
    });
  });

  describe('validators', () => {
    it('httpUrlValidator accepts empty and http(s), flags the rest', () => {
      const validator = httpUrlValidator();
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl('https://x.com/zona8'))).toBeNull();
      expect(validator(new FormControl('instagram.com/zona8'))).toEqual({ url: true });
      expect(validator(new FormControl('javascript:alert(1)'))).toEqual({ url: true });
    });

    it('googleMapsUrlValidator accepts empty and Google Maps, flags the rest', () => {
      const validator = googleMapsUrlValidator();
      expect(validator(new FormControl(null))).toBeNull();
      expect(validator(new FormControl('https://maps.app.goo.gl/x'))).toBeNull();
      expect(validator(new FormControl('https://example.com/maps'))).toEqual({ mapsUrl: true });
    });
  });
});
