import React, { useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { Layout } from './Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SafeAreaLayout } from './components/SafeAreaLayout';

import { Reports } from './Reports';
import { TransactionReport } from './TransactionReport';
import { Directors } from './Directors';
import { Customers } from './Customers';
import { Investments } from './Investments';
import { TransactionMenu } from './TransactionMenu';
import { Dashboard } from './Dashboard';
import { Banks } from './Banks';
import { UserManagement } from './UserManagement';
import { Profile } from './Profile';

// Lazy load components only for non-critical pages if any
const Login = lazy(() => import('./Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./Register').then(m => ({ default: m.Register })));

// ব্যাক বাটন এবং এক্সিট এলার্ট হ্যান্ডেলার
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Configure Status Bar
    const setupStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      } catch (e) {
        console.warn('StatusBar not available', e);
      }
    };
    setupStatusBar();

    const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // যদি ইউজার মেইন ড্যাশবোর্ড বা লগইন পেজে থাকে
      const isHomePage = location.pathname === '/' || location.pathname === '/dashboard';
      const isLoginPage = location.pathname === '/login';

      if (isHomePage || isLoginPage) {
        // এক্সিট করার আগে কনফার্মেশন এলার্ট
        const confirmExit = window.confirm("আপনি কি অ্যাপ থেকে বের হতে চান?");
        if (confirmExit) {
          CapacitorApp.exitApp();
        }
      } else {
        // অন্য যেকোনো পেজ থেকে ধাপে ধাপে পেছনে যাবে
        const event = new CustomEvent('app:back', { cancelable: true });
        const wasCancelled = !window.dispatchEvent(event);
        if (!wasCancelled) {
          navigate(-1);
        }
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [location, navigate]);

  return null;
};

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const { user, loading, role } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  
  if (requiredRole && role !== requiredRole && role !== 'super_admin') {
    return <Navigate to="/" />;
  }
  
  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  const { loading } = useAuth();
  
  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaLayout>
      <Router>
        {/* ব্যাক বাটন লজিক */}
        <BackButtonHandler />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/directors" element={<ProtectedRoute><Directors /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/banks" element={<ProtectedRoute><Banks /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute requiredRole="admin"><TransactionMenu /></ProtectedRoute>} />
            <Route path="/investments" element={<ProtectedRoute><Investments /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/transaction-report" element={<ProtectedRoute><TransactionReport /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredRole="super_admin"><UserManagement /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Router>
    </SafeAreaLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
