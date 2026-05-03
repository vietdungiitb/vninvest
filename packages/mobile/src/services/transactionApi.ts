import authClient from './http';
import type { StockSuggestion, SubAccountItem, TransactionItem, TransactionPayload } from '../types/transaction';

export async function getSubAccounts(): Promise<SubAccountItem[]> {
  const response = await authClient.get<SubAccountItem[]>('/portfolio/subaccounts/');
  return response.data;
}

export async function getTransactions(subAccountId: number): Promise<TransactionItem[]> {
  const response = await authClient.get<TransactionItem[]>(`/portfolio/subaccounts/${subAccountId}/transactions/`);
  return response.data;
}

export async function createTransaction(subAccountId: number, payload: TransactionPayload): Promise<TransactionItem> {
  const response = await authClient.post<TransactionItem>(`/portfolio/subaccounts/${subAccountId}/transactions/`, payload);
  return response.data;
}

export async function updateTransaction(transactionId: number, payload: TransactionPayload): Promise<TransactionItem> {
  const response = await authClient.put<TransactionItem>(`/portfolio/transactions/${transactionId}/`, payload);
  return response.data;
}

export async function deleteTransaction(transactionId: number): Promise<void> {
  await authClient.delete(`/portfolio/transactions/${transactionId}/`);
}

export async function validateStockSymbol(symbol: string): Promise<boolean> {
  try {
    await authClient.get(`/stock-management/stocks/${symbol.toUpperCase().trim()}/`);
    return true;
  } catch {
    return false;
  }
}

export async function searchStocks(query: string): Promise<StockSuggestion[]> {
  if (!query || query.trim().length < 1) {
    return [];
  }
  const response = await authClient.get<{ results?: StockSuggestion[]; count?: number } | StockSuggestion[]>(
    `/stock-management/stocks/?search=${encodeURIComponent(query.trim().toUpperCase())}`
  );
  // Backend trả list hoặc paginated { results: [] }
  const data = response.data;
  if (Array.isArray(data)) {
    return data.slice(0, 8);
  }
  return (data.results ?? []).slice(0, 8);
}