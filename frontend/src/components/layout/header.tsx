'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, RefreshCw, Menu, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { usePortfolio } from '@/contexts/portfolio-context';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { marketDataApi } from '@/lib/api';
import { toast } from 'sonner';
import { SidebarContent } from './sidebar';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { portfolios, selectedPortfolio, selectPortfolioById, fetchPortfolios } = usePortfolio();
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSync = async () => {
    if (!selectedPortfolio) return;
    
    setIsSyncing(true);
    try {
      const result = await marketDataApi.sync([], selectedPortfolio.id);
      if (result.success) {
        toast.success(`Synced ${result.symbolsSynced.length} symbols`);
      } else {
        toast.warning(`Synced with errors: ${result.symbolsFailed.join(', ')}`);
      }
    } catch (error) {
      toast.error('Failed to sync market data');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="h-16 flex flex-row items-center gap-2 px-6 border-b">
              <Wallet className="h-8 w-8 text-primary" />
              <SheetTitle className="text-xl font-bold">CapitalForge</SheetTitle>
            </SheetHeader>
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Portfolio Selector */}
        <Select
          value={selectedPortfolio?.id || ''}
          onValueChange={selectPortfolioById}
        >
          <SelectTrigger className="w-[140px] md:w-[200px]">
            <SelectValue placeholder="Select portfolio" />
          </SelectTrigger>
          <SelectContent>
            {portfolios.map((portfolio) => (
              <SelectItem key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPortfolio && (
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
            ${selectedPortfolio.totalCapital.toLocaleString()}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Sync Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || !selectedPortfolio}
          className="hidden sm:flex"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Data
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleSync}
          disabled={isSyncing || !selectedPortfolio}
          className="sm:hidden"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
