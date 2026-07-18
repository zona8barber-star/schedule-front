export interface ReportProfessionalIncomeView {
  staffProfileId: string;
  displayName: string;
  incomeTotal: number;
  incomeCount: number;
  businessTotal: number;
  professionalTotal: number;
}

export interface ReportExpenseConceptView {
  name: string;
  total: number;
}

export interface ReportTrendPointView {
  bucket: string;
  from: string; // YYYY-MM-DD
  income: number;
  expenses: number;
}

export interface ReportSummaryView {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeCount: number;
  promoIncome: number;
  normalIncome: number;
  businessIncome: number;
  professionalIncome: number;
  byProfessional: ReportProfessionalIncomeView[];
  byExpenseConcept: ReportExpenseConceptView[];
  trend: ReportTrendPointView[];
}
