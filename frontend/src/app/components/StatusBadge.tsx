import { cn } from './ui/utils';

type Status = 'online' | 'offline' | 'warning' | 'success' | 'failed';

interface StatusBadgeProps {
  status: Status;
  children: React.ReactNode;
  withDot?: boolean;
}

export function StatusBadge({ status, children, withDot = false }: StatusBadgeProps) {
  const variants = {
    online: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    offline: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const dotColors = {
    online: 'bg-emerald-400',
    offline: 'bg-slate-400',
    warning: 'bg-amber-400',
    success: 'bg-emerald-400',
    failed: 'bg-red-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border',
        variants[status]
      )}
    >
      {withDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[status])} />
      )}
      {children}
    </span>
  );
}
