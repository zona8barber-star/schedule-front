// ADR-0020: bills (internal receipts), stages 2 and 3. Mirrors Barbershop.Application.Bills. Amounts are whole pesos.

export type BillStatus = 'Open' | 'Closed' | 'Approved' | 'Unapproved' | 'Voided';
export type BillLineType = 'Service' | 'Product' | 'MembershipConsumption' | 'Redemption' | 'Discount' | 'Tip';
export type TipPaymentMode = 'WithBill' | 'Direct';

export interface BillActionsView {
  canEdit: boolean;
  canDiscount: boolean;
  canClose: boolean;
  canCharge: boolean;
  canVoid: boolean;
  canApprove: boolean;
  canDetachAppointment: boolean;
  canChangePaymentMethod: boolean;
  /** ADR-0020 stage 4: bills.unapprove (critical) on an approved bill. */
  canUnapprove?: boolean;
}

export interface BillLineView {
  id: string;
  position: number;
  type: BillLineType;
  staffProfileId: string | null;
  staffName: string | null;
  staffIsActive: boolean;
  generalServiceId: string | null;
  serviceId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  businessPercentage: number | null;
  isCourtesy: boolean;
  reason: string | null;
  productId: string | null;
  customerMembershipId: string | null;
  membershipName: string | null;
  loyaltyRedemptionId: string | null;
  appliesToLineId: string | null;
  tipPaymentMode: TipPaymentMode | null;
  catalogPriceNow: number | null;
  availableStock: number | null;
}

export interface BillView {
  id: string;
  number: string | null;
  status: BillStatus;
  appointmentId: string | null;
  appointmentStartsAt: string | null;
  appointmentStatus: string | null;
  customerId: string | null;
  customerName: string;
  isWalkIn: boolean;
  staffProfileId: string | null;
  staffName: string | null;
  serviceDate: string;
  notes: string | null;
  openedAt: string;
  openedByName: string | null;
  closedAt: string | null;
  closedByName: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  subtotal: number;
  discountTotal: number;
  tipTotal: number;
  directTipTotal: number;
  total: number;
  approvedAt: string | null;
  approvedByName: string | null;
  isSelfApproved: boolean;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  isOverdue: boolean;
  version: number;
  lines: BillLineView[];
  warnings: string[];
  actions: BillActionsView;
  /** ADR-0020 stage 4: approvals so far and the last unapproval. */
  approvalCount?: number;
  lastUnapprovedAt?: string | null;
  lastUnapprovedByName?: string | null;
  lastUnapprovalReason?: string | null;
}

export interface BillSummaryView {
  id: string;
  number: string | null;
  status: BillStatus;
  appointmentId: string | null;
  customerName: string;
  isWalkIn: boolean;
  staffProfileId: string | null;
  staffName: string | null;
  staffIsActive: boolean;
  serviceDate: string;
  total: number;
  lineCount: number;
  paymentMethodName: string | null;
  openedAt: string;
  closedAt: string | null;
  isOverdue: boolean;
  isSelfApproved: boolean;
  hasRedemptions: boolean;
}

export interface BillPendingAppointmentView {
  appointmentId: string;
  startsAt: string;
  customerName: string;
  serviceName: string | null;
  staffProfileId: string;
  staffName: string;
}

export interface BillPendingView {
  openBills: BillSummaryView[];
  appointmentsWithoutBill: BillPendingAppointmentView[];
  count: number;
}

export interface BillRateOption {
  id: string;
  name: string;
  price: number;
  loyaltyPoints: number;
  isActive: boolean;
}

export interface BillGeneralServiceOption {
  id: string;
  name: string;
  categoryName: string;
  rates: BillRateOption[];
}

export interface BillOptionsView {
  services: BillGeneralServiceOption[];
  products: { id: string; name: string; price: number; availableStock: number | null }[];
  staff: { id: string; displayName: string; isActive: boolean }[];
  paymentMethods: { id: string; name: string }[];
  ownStaffProfileId: string | null;
  canManage: boolean;
  canDiscount: boolean;
  canCharge: boolean;
  canClose: boolean;
  canApprove: boolean;
  canVoid: boolean;
  /** ADR-0021 L1: may put services, consumptions, redemptions and tips on another professional's name. */
  canAssignOtherStaff?: boolean;
}

export interface BillCustomerOption {
  id: string;
  fullName: string;
  phoneHint: string | null;
}

export interface BillMembershipOption {
  id: string;
  planName: string;
  endsOn: string;
  services: { serviceId: string; name: string; generalServiceId: string; available: number }[];
}

export interface BillRedemptionOption {
  id: string;
  rewardName: string;
  kind: 'Service' | 'Other';
  serviceId: string | null;
  serviceName: string | null;
  pointsCost: number;
  deliverBy: string | null;
}

export interface BillEventView {
  id: string;
  type: string;
  statusAtEvent: BillStatus;
  userName: string | null;
  createdAt: string;
  reason: string | null;
  before: string | null;
  after: string | null;
}

export interface BillListQuery {
  status?: BillStatus | null;
  staffProfileId?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  /** ADR-0020 stage 5: the customer's profile and the profiles merged into it. */
  customerId?: string | null;
  paymentMethodId?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface BillOpenRequest {
  idempotencyKey: string;
  appointmentId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  serviceDate?: string | null;
  staffProfileId?: string | null;
  notes?: string | null;
}

export interface BillLineRequest {
  version: number;
  type?: BillLineType;
  staffProfileId?: string | null;
  generalServiceId?: string | null;
  serviceId?: string | null;
  productId?: string | null;
  quantity?: number | null;
  customerMembershipId?: string | null;
  loyaltyRedemptionId?: string | null;
  amount?: number | null;
  reason?: string | null;
  appliesToLineId?: string | null;
  tipPaymentMode?: TipPaymentMode | null;
  isCourtesy?: boolean;
}

export interface BillApprovalLinePreview {
  lineId: string;
  type: BillLineType;
  name: string;
  staffName: string | null;
  staffIsActive: boolean;
  gross: number;
  discountShare: number;
  net: number;
  professionalAmount: number;
  businessAmount: number;
  eligiblePoints: number | null;
  catalogPriceNow: number | null;
  priceChanged: boolean;
  effect: string;
}

export interface BillApprovalPreviewView {
  billId: string;
  version: number;
  lines: BillApprovalLinePreview[];
  wouldBeSelfApproved: boolean;
  needsDeliverPermission: boolean;
  loyaltyEnabled: boolean;
  warnings: string[];
}

export interface PaymentMethodView {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  Open: 'Abierta',
  Closed: 'Por aprobar',
  Approved: 'Aprobada',
  Unapproved: 'En corrección',
  Voided: 'Anulada',
};

export const BILL_LINE_TYPE_LABELS: Record<BillLineType, string> = {
  Service: 'Servicio',
  Product: 'Producto',
  MembershipConsumption: 'Consumo de membresía',
  Redemption: 'Canje de puntos',
  Discount: 'Descuento',
  Tip: 'Propina',
};

export const TIP_PAYMENT_MODE_LABELS: Record<TipPaymentMode, string> = {
  WithBill: 'Cobrada con la cuenta',
  Direct: 'Pagada directo al profesional',
};

/** What approving does with each line (ADR-0020 §3), in the words of the approval review. */
export const BILL_EFFECT_LABELS: Record<string, string> = {
  ServiceIncome: 'Ingreso del servicio y comisión',
  Courtesy: 'Cortesía: sin ingreso ni comisión',
  ProductSale: 'Venta de producto y salida de inventario',
  MembershipConsumption: 'Consumo de la membresía',
  RedemptionDelivery: 'Entrega del canje',
  TipIncome: 'Propina para el profesional',
  DirectTip: 'Propina pagada directo: solo queda registrada',
  Discount: 'Descuento repartido en las líneas',
};

/** ADR-0020 stage 5 (Q23): what the customer sees of a bill; never its internal states, commissions or costs. */
export type MyBillStatus = 'Issued' | 'UnderReview' | 'Voided';

export const MY_BILL_STATUS_LABELS: Record<MyBillStatus, string> = {
  Issued: 'Emitido',
  UnderReview: 'En revisión',
  Voided: 'Anulado',
};

export interface MyBillSummaryView {
  id: string;
  number: string;
  status: MyBillStatus;
  serviceDate: string;
  closedAt: string;
  total: number;
  paymentMethodName: string | null;
}

export interface MyBillLineView {
  type: BillLineType;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isCourtesy: boolean;
  staffName: string | null;
  tipPaymentMode: TipPaymentMode | null;
}

export interface MyBillView {
  id: string;
  number: string;
  status: MyBillStatus;
  serviceDate: string;
  closedAt: string;
  customerName: string;
  lines: MyBillLineView[];
  subtotal: number;
  discountTotal: number;
  tipTotal: number;
  directTipTotal: number;
  total: number;
  paymentMethodName: string | null;
}

/** ADR-0020 stage 5: what was charged, by day and payment method (closed bills; the voided ones apart). */
export interface CashClosingMethodView {
  paymentMethodId: string;
  name: string;
  billCount: number;
  total: number;
}

export interface CashClosingDayView {
  day: string;
  methods: CashClosingMethodView[];
  billCount: number;
  total: number;
}

export interface CashClosingView {
  from: string;
  to: string;
  days: CashClosingDayView[];
  methods: CashClosingMethodView[];
  billCount: number;
  total: number;
  voidedCount: number;
  voidedTotal: number;
}
