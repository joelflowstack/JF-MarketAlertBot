export function LoadingSpinner({ size = 20, className = '' }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-border border-t-primary ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
