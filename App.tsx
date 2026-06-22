import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { MealPlan } from './components/MealPlan';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';
import ShoppingCart, { CheckoutData } from './components/ShoppingCart';
import Checkout from './components/Checkout';
import { OrderListPage } from './components/OrderListPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { ActivityLevel, AppTab, Gender, UserProfile, MealRecommendation, DailyStats, WeightData } from './types';
import { MOCK_MEALS, MOCK_STATS } from './constants';

const INITIAL_PROFILE: UserProfile = {
  gender: Gender.MALE,
  age: 28,
  height: 175,
  weight: 70,
  targetWeight: 65,
  activityLevel: ActivityLevel.MODERATE,
};

const INITIAL_WEIGHT_HISTORY: WeightData[] = Array.from({ length: 90 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (89 - i));
  const isToday = i === 89;
  return {
    date: isToday ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`,
    weight: Number((78 - (i * 0.08) + (Math.random() * 0.5 - 0.25)).toFixed(1))
  };
});
INITIAL_WEIGHT_HISTORY[89].weight = 70.0;

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.DASHBOARD);

  // -- Persistent States --
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : INITIAL_PROFILE;
  });

  const [meals, setMeals] = useState<MealRecommendation[]>(() => {
    const saved = localStorage.getItem('meals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 防呆：若舊版快取中的資料缺少營養素擴充（例如 sugar），則強制載入最新的 MOCK_MEALS
        if (parsed.length > 0 && parsed[0].macros?.sugar === undefined) {
          return MOCK_MEALS;
        }
        return parsed;
      } catch (e) {
        return MOCK_MEALS;
      }
    }
    return MOCK_MEALS;
  });

  const [dailyStats, setDailyStats] = useState<DailyStats>(() => {
    const saved = localStorage.getItem('dailyStats');
    return saved ? JSON.parse(saved) : MOCK_STATS;
  });

  const [weightHistory, setWeightHistory] = useState<WeightData[]>(() => {
    const saved = localStorage.getItem('weightHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length < 90) return INITIAL_WEIGHT_HISTORY;
        return parsed;
      } catch (e) {
        return INITIAL_WEIGHT_HISTORY;
      }
    }
    return INITIAL_WEIGHT_HISTORY;
  });

  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // -- Persistence Effects --
  useEffect(() => { localStorage.setItem('userProfile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('meals', JSON.stringify(meals)); }, [meals]);
  useEffect(() => { localStorage.setItem('dailyStats', JSON.stringify(dailyStats)); }, [dailyStats]);
  useEffect(() => { localStorage.setItem('weightHistory', JSON.stringify(weightHistory)); }, [weightHistory]);

  useEffect(() => {
    // Check for API key on mount to show helpful error if missing
    const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    const localKey = localStorage.getItem('gemini_api_key');
    if (!envKey && !localKey) {
      setApiKeyMissing(true);
    }
  }, []);

  const handleAddMeal = (newMeal: MealRecommendation) => {
    setMeals((prev) => [...prev, newMeal]);
  };

  const handleUpdateProfile = (newProfile: UserProfile) => {
    if (newProfile.weight !== userProfile.weight) {
      const todayString = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
      setWeightHistory(prev => {
        const newHistory = [...prev];
        // If last entry is today, update it; otherwise push new
        if (newHistory[newHistory.length - 1].date === '今日' || newHistory[newHistory.length - 1].date === todayString) {
          newHistory[newHistory.length - 1] = { date: '今日', weight: newProfile.weight };
          return [...newHistory];
        }
        return [...newHistory, { date: '今日', weight: newProfile.weight }].slice(-90);
      });
    }
    setUserProfile(newProfile);
  };

  const handleAddCalories = (calories: number) => {
    setDailyStats(prev => ({
      ...prev,
      calories: {
        ...prev.calories,
        current: prev.calories.current + calories
      }
    }));
  };

  const renderContent = () => {
    switch (currentTab) {
      case AppTab.DASHBOARD:
        return (
          <Dashboard
            userProfile={userProfile}
            stats={dailyStats}
            onAddCalories={handleAddCalories}
          />
        );
      case AppTab.MEAL_PLAN:
        return <MealPlan userProfile={userProfile} meals={meals} />;
      case AppTab.SHOPPING_CART:
        return (
          <ShoppingCart 
            onCheckout={(data) => {
              setCheckoutData(data);
              setCurrentTab(AppTab.CHECKOUT);
            }} 
          />
        );
      case AppTab.CHECKOUT:
        return (
          <Checkout 
            data={checkoutData}
            onBack={() => setCurrentTab(AppTab.SHOPPING_CART)} 
            onPlaceOrder={(orderId) => {
              setSelectedOrderId(orderId);
              setCurrentTab(AppTab.ORDER_DETAIL);
            }}
          />
        );
      case AppTab.PROFILE:
        return (
          <Profile
            data={userProfile}
            weightHistory={weightHistory}
            onSave={handleUpdateProfile}
            onAdminAccess={() => setCurrentTab(AppTab.ADMIN)}
          />
        );
      case AppTab.ADMIN:
        return (
          <AdminPanel
            meals={meals}
            onAddMeal={handleAddMeal}
            onUpdateMeal={(updatedMeal) => {
              setMeals(prev => prev.map(m => m.id === updatedMeal.id ? updatedMeal : m));
            }}
            onDeleteMeal={(mealId) => {
              setMeals(prev => prev.filter(m => m.id !== mealId));
            }}
            onBack={() => setCurrentTab(AppTab.DASHBOARD)}
          />
        );
      case AppTab.ORDERS:
        return (
          <OrderListPage 
            onOrderClick={(orderId) => {
              setSelectedOrderId(orderId);
              setCurrentTab(AppTab.ORDER_DETAIL);
            }} 
          />
        );
      case AppTab.ORDER_DETAIL:
        return (
          <OrderDetailPage 
            orderId={selectedOrderId} 
            onBack={() => setCurrentTab(AppTab.ORDERS)} 
          />
        );
      default:
        return (
          <Dashboard
            userProfile={userProfile}
            stats={dailyStats}
            onAddCalories={handleAddCalories}
          />
        );
    }
  };

  if (apiKeyMissing) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-2xl">
          <h1 className="text-3xl font-bold mb-4 text-primary-400">Welcome to HealthGenie</h1>
          <p className="text-slate-300 mb-6">
            To use this app, please enter your Google Gemini API Key.
          </p>

          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem('apiKey') as HTMLInputElement;
            if (input.value.trim()) {
              localStorage.setItem('gemini_api_key', input.value.trim());
              setApiKeyMissing(false);
              window.location.reload();
            }
          }} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-400 mb-1">
                Gemini API Key
              </label>
              <input
                type="password"
                name="apiKey"
                id="apiKey"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="AIza..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Start App
            </button>
            <p className="text-xs text-slate-500 text-center mt-4">
              Your key is stored locally in your browser.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;
