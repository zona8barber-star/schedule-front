export interface ExpenseEntryView {
  id: string;
  fixedExpenseId: string | null;
  name: string;
  amount: number;
  occurredOn: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string | null;
}

export interface ExpenseEntryCreateRequest {
  fixedExpenseId: string | null;
  name: string;
  amount: number;
  occurredOn: string; // YYYY-MM-DD
}

export interface ExpenseEntryUpdateRequest {
  fixedExpenseId: string | null;
  name: string;
  amount: number;
  occurredOn: string; // YYYY-MM-DD
}
