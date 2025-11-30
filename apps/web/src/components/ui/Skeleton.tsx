import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-800/50', className)}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-6 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="glass-card p-6 space-y-3">
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="glass-card p-6">
      <Skeleton className="h-6 w-32 mb-4" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
