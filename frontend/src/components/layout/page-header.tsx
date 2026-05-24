import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Keep subtitle visible on mobile (e.g. record counts). Default hides on mobile. */
  showSubtitleOnMobile?: boolean;
  actions?: React.ReactNode;
  titleSize?: 'default' | 'large';
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  showSubtitleOnMobile = false,
  actions,
  titleSize = 'default',
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-4 md:mb-8', className)}>
      <div className="flex items-start justify-between gap-2 md:gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="label-caps mb-0.5 hidden md:block md:mb-1 md:text-xs">{eyebrow}</p>
          )}
          <h1
            className={cn(
              'font-serif font-normal text-foreground leading-tight',
              titleSize === 'large'
                ? 'text-2xl md:text-4xl lg:text-5xl'
                : 'text-2xl md:text-4xl',
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={cn(
                'text-xs text-muted-foreground mt-0.5 md:mt-1 md:text-sm',
                !showSubtitleOnMobile && 'hidden md:block',
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-1 md:gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
