'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  PieChart,
  Target,
  DollarSign,
  History,
  Settings,
  LogOut,
  Wallet,
  BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';

export const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Allocation', href: '/allocation', icon: PieChart },
  { name: 'Strategy', href: '/strategy', icon: Target },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Budget', href: '/budget', icon: DollarSign },
  { name: 'Transactions', href: '/transactions', icon: History },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    // Use full page reload instead of client-side navigation
    window.location.href = '/auth/login';
  };

  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User section */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            asChild
            onClick={onNavigate}
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <div className="hidden md:flex h-full w-64 flex-col bg-card border-r">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <Wallet className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold">CapitalForge</span>
      </div>
      <SidebarContent />
    </div>
  );
}
