'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from './header';
import { BottomTabBar } from './bottom-tab-bar';
import { useAuth } from '@/contexts/auth-context';
import { usePortfolio } from '@/contexts/portfolio-context';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLoadingScreen } from './app-loading-screen';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { fetchPortfolios, isLoading: portfolioLoading, hasFetched } = usePortfolio();
  const router = useRouter();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      setHasCheckedAuth(true);
      if (!isAuthenticated) {
        router.push('/auth/login');
      }
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPortfolios();
    }
  }, [isAuthenticated, fetchPortfolios]);

  if (authLoading || !hasCheckedAuth) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-48">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const portfolioPending = portfolioLoading || !hasFetched;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <main className="flex-1 w-full px-4 md:px-8 py-3 md:py-6 pb-24 md:pb-8">
        {portfolioPending ? <AppLoadingScreen withNav /> : children}
      </main>
      <BottomTabBar />
    </div>
  );
}
