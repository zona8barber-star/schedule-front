/** General conditions preloaded on every new membership type; the admin can edit them per type. */
export const DEFAULT_MEMBERSHIP_TERMS = [
  '• La membresía es personal e intransferible.',
  '• No se realizan devoluciones de dinero como política comercial, sin perjuicio de las excepciones legales aplicables.',
  '• Los servicios no consumidos se pierden al finalizar la vigencia.',
  '• No se permiten nuevos consumos sobre membresías vencidas.',
].join('\n');

export const MEMBERSHIP_MAX_QUANTITY = 1000;
export const MEMBERSHIP_MAX_DURATION_DAYS = 3650;

export const GIFT_CONDITION_LABELS = {
  EveryPurchase: 'En cada compra',
  FirstPurchaseOfPlan: 'Solo en la primera compra de este tipo',
} as const;
