export type SubAccountItem = {
  id: number;
  name: string;
  type: string;
  type_display?: string;
  portfolio?: number;
  portfolio_name?: string;
};

export type StockSuggestion = {
  symbol: string;
  company_name: string;
  exchange?: string;
};

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND';

export type TransactionItem = {
  id: number;
  sub_account: number;
  sub_account_name?: string;
  sub_account_type?: string;
  symbol: string;
  transaction_type: TransactionType;
  transaction_type_display?: string;
  date: string;
  price: number | string;
  quantity: number | string;
  fee: number | string;
  notes?: string;
  total_value?: number | string;
  created_at?: string;
};

export type TransactionPayload = {
  symbol: string;
  transaction_type: TransactionType;
  date: string;
  price: number;
  quantity: number;
  fee: number;
  notes?: string;
};
