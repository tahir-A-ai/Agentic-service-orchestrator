import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, openAuth } = useAuth();

  useEffect(() => {
    // If not authenticated, open the login modal
    if (!isAuthenticated && openAuth) {
      openAuth('login');
    }
  }, [isAuthenticated, openAuth]);

  if (!isAuthenticated) {
    // Redirect to home page
    return <Navigate to="/" replace />;
  }

  // Check roles if allowedRoles is specified
  if (allowedRoles && allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role)) {
      // Redirect to a sensible default if they don't have access
      if (user.role === 'provider') {
        return <Navigate to="/provider/dashboard" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
