import React, { useCallback, useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import Checkout from './components/Checkout';
import { Dashboard } from './components/Dashboard';
import { Layout } from './components/Layout';
import { MealPlan } from './components/MealPlan';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrderListPage } from './components/OrderListPage';
import { Profile } from './components/Profile';
import ShoppingCart, { CheckoutData } from './components/ShoppingCart';
import { ToastViewport } from './components/ToastViewport';
import {
  getProducts,
  getUser,
  saveProducts,
  saveUser,
  UserData,
} from './data/repository';
import { AppTab, MealRecommendation, UserProfile } from './types';
import { showToast } from './utils/notifications';
import { toSafeNumber } from './utils/numbers';

const parseRoute = (): { tab: AppTab; orderId: string | null } => {
  const [tabValue, orderId] = window.location.hash.replace(/^#\/?/, '').split('/');
  const tab = Object.values(AppTab).includes(tabValue as AppTab)
    ? tabValue as AppTab
    : AppTab.DASHBOARD;
  return { tab, orderId: orderId || null };
};

const App: React.FC = () => {
  const initialRoute = parseRoute();
  const [currentTab, setCurrentTab] = useState<AppTab>(initialRoute.tab);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialRoute.orderId);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [userData, setUserData] = useState<UserData>(() => getUser());
  const [meals, setMeals] = useState<MealRecommendation[]>(() => getProducts());

  const navigate = useCallback((tab: AppTab, orderId?: string | null) => {
    setCurrentTab(tab);
    setSelectedOrderId(orderId || null);
    const hash = `#/${tab}${orderId ? `/${orderId}` : ''}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }, []);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', `#/${AppTab.DASHBOARD}`);
    const handleHashChange = () => {
      const route = parseRoute();
      setCurrentTab(route.tab);
      setSelectedOrderId(route.orderId);
    };
    const handleProducts = () => setMeals(getProducts());
    const handleUser = () => setUserData(getUser());
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('products_updated', handleProducts);
    window.addEventListener('user_updated', handleUser);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('products_updated', handleProducts);
      window.removeEventListener('user_updated', handleUser);
    };
  }, []);

  const persistUser = (next: UserData, successMessage?: string) => {
    if (saveUser(next)) {
      setUserData(next);
      if (successMessage) showToast(successMessage);
    } else showToast('資料儲存失敗，請稍後再試', 'error');
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    let weightHistory = [...userData.weightHistory];
    if (toSafeNumber(profile.weight) !== toSafeNumber(userData.profile.weight)) {
      const today = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
      const entry = { date: '今日', weight: toSafeNumber(profile.weight) };
      if (weightHistory.at(-1)?.date === '今日' || weightHistory.at(-1)?.date === today) {
        weightHistory[weightHistory.length - 1] = entry;
      } else {
        weightHistory = [...weightHistory, entry].slice(-90);
      }
    }
    persistUser({
      ...userData,
      profile,
      weightHistory,
      dietaryPreferences: profile.dietaryPreferences || userData.dietaryPreferences,
    }, '個人資料已儲存');
  };

  const handleAddCalories = (calories: number) => {
    persistUser({
      ...userData,
      dailyStats: {
        ...userData.dailyStats,
        calories: {
          ...userData.dailyStats.calories,
          current: Math.max(0, toSafeNumber(userData.dailyStats.calories.current) + toSafeNumber(calories)),
        },
      },
    }, '飲食紀錄已儲存');
  };

  const addMeal = (meal: MealRecommendation) => {
    const next = [...meals, meal];
    if (saveProducts(next)) setMeals(next);
    else showToast('餐點上架失敗，請稍後再試', 'error');
  };

  const updateMeal = (meal: MealRecommendation) => {
    const next = meals.map((candidate) => candidate.id === meal.id ? meal : candidate);
    if (saveProducts(next)) setMeals(next);
    else showToast('餐點資料儲存失敗', 'error');
  };

  const deleteMeal = (mealId: string) => {
    const next = meals.filter((meal) => meal.id !== mealId);
    if (saveProducts(next)) setMeals(next);
    else showToast('餐點刪除失敗', 'error');
  };

  const renderContent = () => {
    switch (currentTab) {
      case AppTab.MEAL_PLAN:
        return <MealPlan userProfile={userData.profile} meals={meals} />;
      case AppTab.SHOPPING_CART:
        return <ShoppingCart onCheckout={(data) => { setCheckoutData(data); navigate(AppTab.CHECKOUT); }} />;
      case AppTab.CHECKOUT:
        return (
          <Checkout
            data={checkoutData}
            onBack={() => navigate(AppTab.SHOPPING_CART)}
            onPlaceOrder={(orderId) => navigate(AppTab.ORDER_DETAIL, orderId)}
          />
        );
      case AppTab.PROFILE:
        return (
          <Profile
            data={userData.profile}
            weightHistory={userData.weightHistory}
            onSave={handleUpdateProfile}
            onAdminAccess={() => navigate(AppTab.ADMIN)}
          />
        );
      case AppTab.ADMIN:
        return (
          <AdminPanel
            meals={meals}
            onAddMeal={addMeal}
            onUpdateMeal={updateMeal}
            onDeleteMeal={deleteMeal}
            onBack={() => navigate(AppTab.DASHBOARD)}
          />
        );
      case AppTab.ORDERS:
        return <OrderListPage onOrderClick={(orderId) => navigate(AppTab.ORDER_DETAIL, orderId)} />;
      case AppTab.ORDER_DETAIL:
        return (
          <OrderDetailPage
            orderId={selectedOrderId}
            onBack={() => navigate(AppTab.ORDERS)}
            onGoToCart={() => navigate(AppTab.SHOPPING_CART)}
          />
        );
      case AppTab.DASHBOARD:
      default:
        return (
          <Dashboard
            userProfile={userData.profile}
            stats={userData.dailyStats}
            onAddCalories={handleAddCalories}
          />
        );
    }
  };

  return (
    <>
      <ToastViewport />
      <Layout currentTab={currentTab} onTabChange={(tab) => navigate(tab)}>
        {renderContent()}
      </Layout>
    </>
  );
};

export default App;
