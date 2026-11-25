import { Navigate } from 'react-router-dom';
import { Lock, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui';

const AdminRoute = ({ children }) => {
  const { isAdmin, user, loading, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg-primary">
        <div className="animate-spin w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg-primary p-4">
        <div className="max-w-md w-full rounded-2xl border border-app-danger/30 bg-app-bg-secondary p-8 text-center">
          <div className="inline-flex w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 items-center justify-center mb-4">
            <Lock size={20} />
          </div>
          <h2 className="font-display text-xl font-semibold text-app-text-primary mb-2">
            Profile unreadable
          </h2>
          <p className="text-sm text-app-text-secondary mb-6">
            Could not load your profile. Please try signing in again.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} leftIcon={<LogOut size={16} />}>
              Retry
            </Button>
            <Button onClick={signOut} variant="ghost" leftIcon={<LogOut size={16} />}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
