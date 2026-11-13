import { toWhatsAppNumber, whatsAppUrl } from './whatsapp-link.utils';

/** SONDA BUG-048: one normalisation for every wa.me link (digits only, country code 57 added only when missing). */
describe('whatsapp-link utils', () => {
  describe('toWhatsAppNumber', () => {
    it.each([
      ['3001234567', '573001234567'],
      ['300 123 4567', '573001234567'],
      ['(300) 123-4567', '573001234567'],
      ['573001234567', '573001234567'],
      ['+57 300 123 4567', '573001234567'],
      ['+57 (300) 123-4567', '573001234567'],
      ['0057 300 123 4567', '573001234567'],
      ['6011234567', '576011234567'],
      ['+1 415 555 0100', '14155550100'],
    ])('%s → %s', (input, expected) => {
      expect(toWhatsAppNumber(input)).toBe(expected);
    });

    it.each([null, undefined, '', '   ', 'abc', '+57 (300) abc', '12345', '57300123456', '+57573001234567', '+12'])(
      'returns null for an unusable number (%s)',
      (input) => {
        expect(toWhatsAppNumber(input)).toBeNull();
      },
    );
  });

  describe('whatsAppUrl', () => {
    it('never duplicates the country code and never uses "+" in the path', () => {
      expect(whatsAppUrl('573001234567')).toBe('https://wa.me/573001234567');
      expect(whatsAppUrl('3001234567')).toBe('https://wa.me/573001234567');
    });

    it('encodes the optional prefilled message', () => {
      expect(whatsAppUrl('3001234567', 'Hola Ana, tengo una cita')).toBe(
        'https://wa.me/573001234567?text=Hola%20Ana%2C%20tengo%20una%20cita',
      );
    });

    it('returns null when the number is not usable, so no link is rendered', () => {
      expect(whatsAppUrl('+57 (300) abc')).toBeNull();
      expect(whatsAppUrl(null, 'Hola')).toBeNull();
    });
  });
});
