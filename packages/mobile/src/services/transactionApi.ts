import authClient from './http';
import type { StockSuggestion, SubAccountItem, TransactionItem, TransactionPayload } from '../types/transaction';

type CorePortfolioItem = {
  id: number;
  name: string;
};

type CoreTransactionItem = {
  id: number;
  symbol: string;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND';
  date: string;
  price: number | string;
  quantity: number | string;
  fee: number | string;
  note?: string;
  created_at?: string;
};

const mapToMobileTransaction = (
  tx: CoreTransactionItem,
  subAccountId: number,
): TransactionItem => ({
  id: tx.id,
  sub_account: subAccountId,
  symbol: tx.symbol,
  transaction_type: tx.transaction_type,
  date: tx.date,
  price: tx.price,
  quantity: tx.quantity,
  fee: tx.fee,
  notes: tx.note || '',
  created_at: tx.created_at,
});

export async function getSubAccounts(): Promise<SubAccountItem[]> {
  const response = await authClient.get<{ results?: CorePortfolioItem[] }>('/core/v1/workspace/portfolios/');
  const portfolios = response.data?.results ?? [];
  return portfolios.map((portfolio) => ({
    id: portfolio.id,
    name: portfolio.name,
    type: '1',
    type_display: 'Danh mục',
    portfolio: portfolio.id,
    portfolio_name: portfolio.name,
  }));
}

export async function getTransactions(subAccountId: number): Promise<TransactionItem[]> {
  const response = await authClient.get<{ results?: CoreTransactionItem[] }>(
    `/core/v1/workspace/portfolios/${subAccountId}/transactions/`
  );
  const transactions = response.data?.results ?? [];
  return transactions.map((tx) => mapToMobileTransaction(tx, subAccountId));
}

export async function createTransaction(subAccountId: number, payload: TransactionPayload): Promise<TransactionItem> {
  const response = await authClient.post<CoreTransactionItem>(
    `/core/v1/workspace/portfolios/${subAccountId}/transactions/`,
    {
      ...payload,
      note: payload.notes || '',
    }
  );
  return mapToMobileTransaction(response.data, subAccountId);
}

export async function updateTransaction(transactionId: number, payload: TransactionPayload): Promise<TransactionItem> {
  const response = await authClient.patch<CoreTransactionItem>(
    `/core/v1/workspace/transactions/${transactionId}/`,
    {
      ...payload,
      note: payload.notes || '',
    }
  );
  return {
    ...mapToMobileTransaction(response.data, 0),
    sub_account: 0,
  };
}

export async function deleteTransaction(transactionId: number): Promise<void> {
  await authClient.delete(`/core/v1/workspace/transactions/${transactionId}/`);
}

export async function validateStockSymbol(symbol: string): Promise<boolean> {
  try {
    await authClient.get(`/core/v1/market-data/symbols/${symbol.toUpperCase().trim()}/`);
    return true;
  } catch {
    return false;
  }
}

export async function searchStocks(query: string): Promise<StockSuggestion[]> {
  if (!query || query.trim().length < 1) {
    return [];
  }
  const search = query.trim().toUpperCase();
  const response = await authClient.get<{ results?: Array<{ symbol: string; company_name: string; exchange?: string }> }>(
    '/core/v1/market-data/symbols/?page=1'
  );
  const rows = response.data?.results ?? [];
  return rows
    .filter((item) => String(item.symbol || '').toUpperCase().includes(search))
    .slice(0, 8)
    .map((item) => ({
      symbol: item.symbol,
      company_name: item.company_name || item.symbol,
      exchange: item.exchange,
    }));
}