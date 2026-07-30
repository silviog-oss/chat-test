import { ReactNode } from 'react';
import { Priority } from '../lib/types';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white font-display font-bold">
        C
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        Chatline
      </span>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, string> = {
    high: 'bg-bad/15 text-bad',
    medium: 'bg-warn/15 text-warn',
    low: 'bg-good/15 text-good',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[priority]}`}
    >
      {priority}
    </span>
  );
}

export function Avatar({
  initials,
  color,
  size = 36,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-display text-xs font-semibold text-white"
      style={{ background: color, width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm opacity-70">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
      {label}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-white/60 p-4 dark:bg-slate1/60 ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide opacity-60">{label}</span>
      <span className="font-display text-2xl font-bold">{value}</span>
    </Card>
  );
}
