'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { portfolioApi } from '@/lib/api';
import type { Portfolio } from '@/lib/types';

interface PortfolioContextType {
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  isLoading: boolean;
  error: string | null;
  fetchPortfolios: () => Promise<void>;
  selectPortfolio: (portfolio: Portfolio | null) => void;
  selectPortfolioById: (id: string) => void;
  refreshPortfolio: () => Promise<void>;
  /** Update portfolio in context (e.g. after apply preset) - updates both selected and list */
  updatePortfolio: (portfolio: Portfolio) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await portfolioApi.getAll();
      setPortfolios(data);
      
      // Auto-select first portfolio if none selected
      if (data.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch portfolios');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPortfolio]);

  const selectPortfolio = (portfolio: Portfolio | null) => {
    setSelectedPortfolio(portfolio);
  };

  const selectPortfolioById = (id: string) => {
    const portfolio = portfolios.find(p => p.id === id);
    if (portfolio) {
      setSelectedPortfolio(portfolio);
    }
  };

  const refreshPortfolio = useCallback(async () => {
    if (selectedPortfolio) {
      try {
        const updated = await portfolioApi.getOne(selectedPortfolio.id);
        setSelectedPortfolio(updated);
        setPortfolios(prev => prev.map(p => p.id === updated.id ? updated : p));
      } catch (err: any) {
        setError(err.message || 'Failed to refresh portfolio');
      }
    }
  }, [selectedPortfolio]);

  const updatePortfolio = useCallback((portfolio: Portfolio) => {
    setSelectedPortfolio(portfolio);
    setPortfolios(prev => prev.map(p => p.id === portfolio.id ? portfolio : p));
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        portfolios,
        selectedPortfolio,
        isLoading,
        error,
        fetchPortfolios,
        selectPortfolio,
        selectPortfolioById,
        refreshPortfolio,
        updatePortfolio,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
