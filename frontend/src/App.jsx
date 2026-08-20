import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';

import LandingPage from './pages/LandingPage';
import ChatPage from './pages/ChatPage';
import ConfirmedPage from './pages/ConfirmedPage';
import ProviderRegisterPage from './pages/ProviderRegisterPage';
import DashboardLayout from './components/provider/Dashboard/DashboardLayout';
import { OverviewTab, ActiveJobsTab, CompletedJobsTab, DeclinedJobsTab, ProfileTab } from './pages/ProviderDashboardPage';
import ReviewsTab from './components/provider/Dashboard/ReviewsTab';
import ProtectedRoute from './components/auth/ProtectedRoute';

/**
 * Configures application routing and provides toast, authentication, and chat contexts.
 */
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ChatProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/provider/register" element={<ProviderRegisterPage />} />

              {/* Chat Flow */}
              <Route path="/chat" element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <ChatPage />
                </ProtectedRoute>
              } />
              <Route path="/chat/confirmed" element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <ConfirmedPage />
                </ProtectedRoute>
              } />

              {/* Protected Dashboard Routes */}
              <Route path="/provider/dashboard" element={
                <ProtectedRoute allowedRoles={['provider']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<OverviewTab />} />
                <Route path="active" element={<ActiveJobsTab />} />
                <Route path="completed" element={<CompletedJobsTab />} />
                <Route path="reviews" element={<ReviewsTab />} />
                <Route path="declined" element={<DeclinedJobsTab />} />
                <Route path="profile" element={<ProfileTab />} />
              </Route>
            </Routes>
          </ChatProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
