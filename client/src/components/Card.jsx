export function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="font-display font-semibold text-text-primary">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
