import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldX } from 'lucide-react';

export default function ProtectedRoute({ permission, children }) {
  const { user, hasPermission } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldX className="w-16 h-16 text-red-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 max-w-md">
          You do not have the required permission to view this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return children;
}
