import React, { useEffect, useState } from 'react';
import { AdminPage } from './components/admin/AdminPage';
import { LoginPage } from './components/auth/LoginPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { SetupRequired } from './components/auth/SetupRequired';
import { CartPage } from './components/customer/CartPage';
import { CheckoutPage } from './components/customer/CheckoutPage';
import { OrderDetailPage } from './components/customer/OrderDetailPage';
import { OrderListPage } from './components/customer/OrderListPage';
import { RecommendPage } from './components/customer/RecommendPage';
import { StoreListPage } from './components/customer/StoreListPage';
import { StorePage } from './components/customer/StorePage';
import { HealthPage } from './components/health/HealthPage';
import { Layout } from './components/Layout';
import { PrivacyPage, TermsPage } from './components/legal/LegalPage';
import { MerchantPage } from './components/merchant/MerchantPage';
import { ProfilePage } from './components/ProfilePage';
import { ToastViewport } from './components/ToastViewport';
import { ErrorState, PageLoading } from './components/ui';
import { AuthProvider, loginPath, useAuth } from './lib/auth';
import { navigate, Route, useRoute } from './lib/router';
import { isSupabaseConfigured } from './lib/supabase';

const RequireLogin: React.FC<{ route: Route; children: React.ReactNode }> = ({ route, children }) => {
  const { session, loading } = useAuth();
  useEffect(() => {
    if (!loading && !session) navigate(loginPath(route.path), { replace: true });
  }, [loading, session, route.path]);
  if (loading || !session) return <PageLoading />;
  return <>{children}</>;
};

/** 管理員權限可能是在登入後才在資料庫開啟的，進入時重新讀取一次 */
const AdminGate: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    refreshProfile().catch(() => undefined).finally(() => setChecked(true));
  }, [refreshProfile]);
  if (!checked && !profile?.isAdmin) return <PageLoading />;
  return profile?.isAdmin ? <AdminPage /> : <ErrorState message="只有平台管理員可以進入這個頁面" />;
};

const Pages: React.FC = () => {
  const route = useRoute();
  const { loading } = useAuth();

  const content = (() => {
    switch (route.page) {
      case 'stores':
        return <StoreListPage />;
      case 'store':
        return route.param ? <StorePage merchantId={route.param} /> : <StoreListPage />;
      case 'recommend':
        return <RecommendPage />;
      case 'cart':
        return <CartPage />;
      case 'login':
        return <LoginPage />;
      case 'privacy':
        return <PrivacyPage />;
      case 'terms':
        return <TermsPage />;
      case 'reset-password':
        return <ResetPasswordPage />;
      case 'checkout':
        return <RequireLogin route={route}><CheckoutPage /></RequireLogin>;
      case 'orders':
        return <RequireLogin route={route}><OrderListPage /></RequireLogin>;
      case 'order':
        return <RequireLogin route={route}><OrderDetailPage orderId={route.param || ''} /></RequireLogin>;
      case 'health':
        return <RequireLogin route={route}><HealthPage /></RequireLogin>;
      case 'me':
        return <RequireLogin route={route}><ProfilePage /></RequireLogin>;
      case 'merchant':
        return <RequireLogin route={route}><MerchantPage tab={route.param || 'orders'} /></RequireLogin>;
      case 'admin':
        return (
          <RequireLogin route={route}>
            {loading ? <PageLoading /> : <AdminGate />}
          </RequireLogin>
        );
      default:
        return <ErrorState message="找不到這個頁面" onRetry={() => navigate('/stores')} />;
    }
  })();

  return <Layout route={route}>{content}</Layout>;
};

const App: React.FC = () => {
  if (!isSupabaseConfigured) return <SetupRequired />;
  return (
    <AuthProvider>
      <ToastViewport />
      <Pages />
    </AuthProvider>
  );
};

export default App;
