'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  PieChart,
  Zap,
  ArrowLeftRight,
  Wallet,
} from 'lucide-react';

const TABS = [
  { name: 'Home',         href: '/',             icon: LayoutDashboard },
  { name: 'Allocations', href: '/allocation',    icon: PieChart        },
  { name: 'Strategy',    href: '/strategy',      icon: Zap             },
  { name: 'Txns',        href: '/transactions',  icon: ArrowLeftRight  },
  { name: 'Budget',      href: '/budget',        icon: Wallet          },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {TABS.map(({ name, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground active:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  isActive && 'scale-110'
                )}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span
                className={cn(
                  'text-[10px] font-medium tracking-wide',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {name}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-foreground rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
