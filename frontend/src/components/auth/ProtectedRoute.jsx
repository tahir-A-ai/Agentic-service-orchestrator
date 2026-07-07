import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, openAuth } = useAuth();

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

  return children;
}
