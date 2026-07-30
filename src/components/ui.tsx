import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Priority } from '../lib/types';

// Clickable brand wordmark. Clicking returns to the landing page (there is no
// separate back button). Shows "Powered by Bizee" beneath, matching bizee.com.
export function Logo({ className = '' }: { className?: string }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav('/')}
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Chatline home"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-white transition-transform group-hover:scale-105">
        C
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className="font-display text-lg font-bold tracking-tight lowercase">
          chatline
        </span>
        <span className="text-[10px] font-medium tracking-wide text-muted">
          powered by <span className="text-primary font-semibold">bizee</span>
        </span>
      </span>
    </button>
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
      className={`rounded-2xl border border-line bg-surface p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="font-display text-2xl font-bold">{value}</span>
    </Card>
  );
}
