import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isVerifying } = useAuth();

  // Still checking whether we're inside the Telegram Mini App - wait for
  // that to resolve before deciding to bounce to the manual login screen,
  // otherwise anyone opening it in Telegram would see a login flash before
  // being auto-authenticated a moment later.
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <LoadingSpinner size={28} />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
