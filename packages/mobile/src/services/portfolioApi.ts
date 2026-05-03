import authClient from './http';
import type { AllocationItem, HoldingItem, PortfolioItem, PortfolioSummary } from '../types/portfolio';

export async function getPortfolios(): Promise<PortfolioItem[]> {
  const response = await authClient.get<PortfolioItem[]>('/portfolio/portfolios/');
  return response.data;
}

export async function getSummary(portfolioId: number): Promise<PortfolioSummary> {
  const response = await authClient.get<PortfolioSummary>(`/portfolio/portfolios/${portfolioId}/summary/`);
  return response.data;
}

export async function getHoldings(portfolioId: number): Promise<HoldingItem[]> {
  const response = await authClient.get<HoldingItem[]>(`/portfolio/portfolios/${portfolioId}/holdings/`);
  return response.data;
}

export async function getAllocation(portfolioId: number): Promise<AllocationItem[]> {
  const response = await authClient.get<AllocationItem[]>(`/portfolio/portfolios/${portfolioId}/allocation/`);
  return response.data;
}