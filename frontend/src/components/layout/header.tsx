'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePortfolio } from '@/contexts/portfolio-context';
import { marketDataApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, ChevronDown, LogOut, Settings, RefreshCw } from 'lucide-react';

const NAV_LINKS = [
  { name: 'Dashboard', href: '/' },
  { name: 'Allocation', href: '/allocation' },
  { name: 'Strategy', href: '/strategy' },
  { name: 'Transactions', href: '/transactions' },
  { name: 'Budget', href: '/budget' },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { portfolios, selectedPortfolio, selectPortfolioById } = usePortfolio();
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    } catch {
      toast.error('Failed to sync market data');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/login';
  };

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="px-8 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="text-foreground font-semibold text-sm tracking-wider">◆ CAPITALFORGE</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors relative',
                  isActive
                    ? 'text-foreground after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:bg-foreground after:rounded-full'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Portfolio selector */}
          {portfolios.length > 1 && (
            <Select value={selectedPortfolio?.id || ''} onValueChange={selectPortfolioById}>
              <SelectTrigger className="h-7 text-xs border-border w-[140px] bg-transparent">
                <SelectValue placeholder="Select portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sync status + button */}
          <button
            onClick={handleSync}
            disabled={isSyncing || !selectedPortfolio}
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <span className={cn('w-1.5 h-1.5 rounded-full bg-emerald-500', isSyncing && 'animate-pulse')} />
            <span className="font-medium tracking-wide uppercase text-[10px]">
              {isSyncing ? 'Syncing…' : 'Live · Yahoo Sync'}
            </span>
            {isSyncing && <RefreshCw className="h-3 w-3 animate-spin ml-0.5" />}
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <span className="hidden sm:block font-medium">
                  {user?.name || user?.email?.split('@')[0] || 'Account'}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 text-xs">
                  <Settings className="h-3.5 w-3.5" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="text-sm font-semibold tracking-wider">◆ CAPITALFORGE</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 space-y-1">
                {NAV_LINKS.map((link) => {
                  const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'block px-3 py-2 text-sm font-medium rounded transition-colors',
                        isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      {link.name}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

// Keep Header alias for backward compat
export { TopNav as Header };
