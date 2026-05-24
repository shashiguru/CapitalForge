import { Skeleton } from '@/components/ui/skeleton';

export function AppLoadingScreen({ withNav = false }: { withNav?: boolean }) {
  return (
    <div className={withNav ? 'space-y-6 py-2' : 'flex h-screen items-center justify-center'}>
      <div className={withNav ? 'space-y-6' : 'space-y-4 w-48'}>
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full rounded-sm" />
          <Skeleton className="h-24 w-full rounded-sm" />
          <Skeleton className="col-span-2 md:col-span-1 h-24 w-full rounded-sm" />
        </div>
        <Skeleton className="h-64 w-full rounded-sm" />
      </div>
    </div>
  );
}
