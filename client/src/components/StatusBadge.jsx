const VARIANTS = {
  online: 'bg-positive/15 text-positive',
  offline: 'bg-negative/15 text-negative',
  pending: 'bg-warning/15 text-warning',
  neutral: 'bg-text-secondary/15 text-text-secondary',
};

export function StatusBadge({ variant = 'neutral', children, pulse = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${VARIANTS[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${pulse ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  );
}
