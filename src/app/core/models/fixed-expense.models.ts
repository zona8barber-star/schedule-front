export interface FixedExpenseView {
  id: string;
  name: string;
  defaultAmount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface FixedExpenseCreateRequest {
  name: string;
  defaultAmount: number | null;
}

export interface FixedExpenseUpdateRequest {
  name: string;
  defaultAmount: number | null;
}

export interface FixedExpenseStatusUpdateRequest {
  isActive: boolean;
}
