import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  Portfolio,
  PortfolioSummary,
  CreatePortfolioDto,
  BudgetPreset,
  Allocation,
  AllocationSummary,
  CreateAllocationDto,
  MarketDataSummary,
  SyncResult,
  StrategySnapshot,
  BuyPlan,
  WeeklyBudget,
  BudgetSummary,
  CreateBudgetDto,
  Transaction,
  TransactionSummary,
  CreateTransactionDto,
  PortfolioAnalytics,
  AllocationChartData,
  BucketUsage,
  DipOpportunity,
  User,
  PortfolioStrategyTable,
  StoredStrategyRules,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token from localStorage
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', credentials);
    return data;
  },

  getProfile: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/profile');
    return data;
  },
};

// Portfolio API
export const portfolioApi = {
  getAll: async (): Promise<Portfolio[]> => {
    const { data } = await api.get<Portfolio[]>('/portfolios');
    return data;
  },

  getOne: async (id: string): Promise<Portfolio> => {
    const { data } = await api.get<Portfolio>(`/portfolios/${id}`);
    return data;
  },

  getSummary: async (id: string): Promise<PortfolioSummary> => {
    const { data } = await api.get<PortfolioSummary>(`/portfolios/${id}/summary`);
    return data;
  },

  create: async (dto: CreatePortfolioDto): Promise<Portfolio> => {
    const { data } = await api.post<Portfolio>('/portfolios', dto);
    return data;
  },

  update: async (id: string, dto: Partial<CreatePortfolioDto>): Promise<Portfolio> => {
    const { data } = await api.patch<Portfolio>(`/portfolios/${id}`, dto);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/portfolios/${id}`);
  },

  getBudgetPresets: async (portfolioId: string): Promise<BudgetPreset[]> => {
    const { data } = await api.get<BudgetPreset[]>(`/portfolios/${portfolioId}/budget-presets`);
    return data;
  },

  createBudgetPreset: async (portfolioId: string, dto: { name: string; totalCapital: number; strategyReferenceBudget?: number; budgetYearStart?: string; budgetYearEnd?: string }): Promise<BudgetPreset> => {
    const { data } = await api.post<BudgetPreset>(`/portfolios/${portfolioId}/budget-presets`, dto);
    return data;
  },

  updateBudgetPreset: async (portfolioId: string, presetId: string, dto: { name?: string; totalCapital?: number; strategyReferenceBudget?: number; budgetYearStart?: string; budgetYearEnd?: string }): Promise<BudgetPreset> => {
    const { data } = await api.patch<BudgetPreset>(`/portfolios/${portfolioId}/budget-presets/${presetId}`, dto);
    return data;
  },

  applyBudgetPreset: async (portfolioId: string, presetId: string): Promise<Portfolio> => {
    const { data } = await api.post<Portfolio>(`/portfolios/${portfolioId}/budget-presets/${presetId}/apply`);
    return data;
  },

  deleteBudgetPreset: async (portfolioId: string, presetId: string): Promise<void> => {
    await api.delete(`/portfolios/${portfolioId}/budget-presets/${presetId}`);
  },
};

// Allocation API
export const allocationApi = {
  getAll: async (portfolioId: string): Promise<Allocation[]> => {
    const { data } = await api.get<Allocation[]>(`/portfolios/${portfolioId}/allocations`);
    return data;
  },

  getSummary: async (portfolioId: string): Promise<AllocationSummary> => {
    const { data } = await api.get<AllocationSummary>(`/portfolios/${portfolioId}/allocations/summary`);
    return data;
  },

  create: async (portfolioId: string, dto: CreateAllocationDto): Promise<Allocation> => {
    const { data } = await api.post<Allocation>(`/portfolios/${portfolioId}/allocations`, dto);
    return data;
  },

  update: async (id: string, dto: Partial<CreateAllocationDto>): Promise<Allocation> => {
    const { data } = await api.patch<Allocation>(`/allocations/${id}`, dto);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/allocations/${id}`);
  },

  bulkUpdate: async (portfolioId: string, allocations: { symbol: string; targetPercentage: number }[]): Promise<Allocation[]> => {
    const { data } = await api.post<Allocation[]>(`/portfolios/${portfolioId}/allocations/bulk`, allocations);
    return data;
  },

  recalculateBuckets: async (portfolioId: string): Promise<void> => {
    await api.post(`/portfolios/${portfolioId}/allocations/recalculate`);
  },
};

// Market Data API
export const marketDataApi = {
  sync: async (symbols: string[], portfolioId?: string): Promise<SyncResult> => {
    const { data } = await api.post<SyncResult>('/market-data/sync', { symbols, portfolioId });
    return data;
  },

  getLatestPrice: async (symbol: string): Promise<any> => {
    const { data } = await api.get(`/market-data/prices/${symbol}`);
    return data;
  },

  getSummary: async (symbol: string): Promise<MarketDataSummary> => {
    const { data } = await api.get<MarketDataSummary>(`/market-data/summary/${symbol}`);
    return data;
  },

  getMultipleSummaries: async (symbols: string[]): Promise<MarketDataSummary[]> => {
    const { data } = await api.post<MarketDataSummary[]>('/market-data/summary/batch', { symbols });
    return data;
  },
};

// Strategy API
export const strategyApi = {
  generate: async (portfolioId: string, weeklyBudget?: number): Promise<StrategySnapshot> => {
    const { data } = await api.post<StrategySnapshot>(
      `/portfolios/${portfolioId}/strategy/generate`,
      { weeklyBudget }
    );
    return data;
  },

  getSnapshots: async (portfolioId: string): Promise<StrategySnapshot[]> => {
    const { data } = await api.get<StrategySnapshot[]>(`/portfolios/${portfolioId}/strategy/snapshots`);
    return data;
  },

  getSnapshot: async (portfolioId: string, snapshotId: string): Promise<StrategySnapshot> => {
    const { data } = await api.get<StrategySnapshot>(`/portfolios/${portfolioId}/strategy/snapshots/${snapshotId}`);
    return data;
  },

  getStrategyTable: async (portfolioId: string): Promise<PortfolioStrategyTable> => {
    const { data } = await api.get<PortfolioStrategyTable>(`/portfolios/${portfolioId}/strategy/table`);
    return data;
  },

  getStrategyRules: async (portfolioId: string): Promise<StoredStrategyRules> => {
    const { data } = await api.get<StoredStrategyRules>(`/portfolios/${portfolioId}/strategy/rules`);
    return data;
  },

  approveBuyPlan: async (buyPlanId: string, approved: boolean): Promise<BuyPlan> => {
    const { data } = await api.post<BuyPlan>(`/buy-plans/${buyPlanId}/approve`, { approved });
    return data;
  },

  executeBuyPlan: async (buyPlanId: string, executedPrice?: number, executedQuantity?: number): Promise<BuyPlan> => {
    const { data } = await api.post<BuyPlan>(`/buy-plans/${buyPlanId}/execute`, {
      executedPrice,
      executedQuantity,
    });
    return data;
  },
};

// Budget API
export const budgetApi = {
  getAll: async (portfolioId: string): Promise<WeeklyBudget[]> => {
    const { data } = await api.get<WeeklyBudget[]>(`/portfolios/${portfolioId}/budgets`);
    return data;
  },

  getCurrent: async (portfolioId: string): Promise<WeeklyBudget | null> => {
    const { data } = await api.get<WeeklyBudget | null>(`/portfolios/${portfolioId}/budgets/current`);
    return data;
  },

  getSummary: async (portfolioId: string): Promise<BudgetSummary> => {
    const { data } = await api.get<BudgetSummary>(`/portfolios/${portfolioId}/budgets/summary`);
    return data;
  },

  create: async (portfolioId: string, dto: CreateBudgetDto): Promise<WeeklyBudget> => {
    const { data } = await api.post<WeeklyBudget>(`/portfolios/${portfolioId}/budgets`, dto);
    return data;
  },

  update: async (id: string, dto: Partial<CreateBudgetDto>): Promise<WeeklyBudget> => {
    const { data } = await api.patch<WeeklyBudget>(`/budgets/${id}`, dto);
    return data;
  },
};

// Core Stock API
export const coreStockApi = {
  getAll: async (portfolioId: string): Promise<{ symbol: string; displayName: string | null }[]> => {
    const { data } = await api.get<{ symbol: string; displayName: string | null }[]>(
      `/portfolios/${portfolioId}/core-stocks`
    );
    return data;
  },
};

// Transaction API
export const transactionApi = {
  getAll: async (portfolioId: string, filters?: { symbol?: string; type?: string; startDate?: string; endDate?: string }): Promise<Transaction[]> => {
    const { data } = await api.get<Transaction[]>(`/portfolios/${portfolioId}/transactions`, { params: filters });
    return data;
  },

  getSummary: async (portfolioId: string): Promise<TransactionSummary> => {
    const { data } = await api.get<TransactionSummary>(`/portfolios/${portfolioId}/transactions/summary`);
    return data;
  },

  create: async (portfolioId: string, dto: CreateTransactionDto): Promise<Transaction> => {
    const { data } = await api.post<Transaction>(`/portfolios/${portfolioId}/transactions`, dto);
    return data;
  },

  update: async (id: string, dto: Partial<CreateTransactionDto>): Promise<Transaction> => {
    const { data } = await api.patch<Transaction>(`/transactions/${id}`, dto);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },

  bulkImport: async (portfolioId: string, transactions: CreateTransactionDto[]): Promise<Transaction[]> => {
    const { data } = await api.post<Transaction[]>(`/portfolios/${portfolioId}/transactions/import`, { transactions });
    return data;
  },
};

// Analytics API
export const analyticsApi = {
  getPortfolioAnalytics: async (portfolioId: string): Promise<PortfolioAnalytics> => {
    const { data } = await api.get<PortfolioAnalytics>(`/portfolios/${portfolioId}/analytics`);
    return data;
  },

  getAllocationChartData: async (portfolioId: string): Promise<AllocationChartData[]> => {
    const { data } = await api.get<AllocationChartData[]>(`/portfolios/${portfolioId}/analytics/allocation-chart`);
    return data;
  },

  getBucketUsage: async (portfolioId: string): Promise<BucketUsage[]> => {
    const { data } = await api.get<BucketUsage[]>(`/portfolios/${portfolioId}/analytics/bucket-usage`);
    return data;
  },

  getDipOpportunities: async (portfolioId: string): Promise<DipOpportunity[]> => {
    const { data } = await api.get<DipOpportunity[]>(`/portfolios/${portfolioId}/analytics/dip-opportunities`);
    return data;
  },

  getPerformance: async (portfolioId: string, days?: number): Promise<any> => {
    const { data } = await api.get(`/portfolios/${portfolioId}/analytics/performance`, { params: { days } });
    return data;
  },
};

export default api;
