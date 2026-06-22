import React, { useMemo, useState } from 'react';
import { ICONS, MOCK_STATS } from '../constants';
import { MealRecommendation, UserProfile } from '../types';
import { calculateHealthTargets, generateHealthWarnings } from '../utils/health';
import { MapPin, Navigation, Info, SlidersHorizontal, X, Check, Store, Minus, Plus, ShoppingCart, AlertTriangle } from 'lucide-react';
import { trackEvent } from '../utils/merchantAnalytics';

interface MealPlanProps {
  userProfile: UserProfile;
  meals: MealRecommendation[];
}

interface FilterState {
  maxPrice: number;
  maxDistance: number;
  onlyHighProtein: boolean;
  excludeNuts: boolean;
}

export const MealPlan: React.FC<MealPlanProps> = ({ userProfile, meals }) => {
  // Filters State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealRecommendation | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  
  // Customization States
  const [mealQuantity, setMealQuantity] = useState(1);
  const [baseOption, setBaseOption] = useState<string>('正常飯量');
  const [flavorOptions, setFlavorOptions] = useState<string[]>([]);
  const [extraOptions, setExtraOptions] = useState<string[]>([]);
  const [userRemark, setUserRemark] = useState<string>('');

  const [filters, setFilters] = useState<FilterState>({
    maxPrice: 300,
    maxDistance: 3,
    onlyHighProtein: false,
    excludeNuts: false,
  });

  // Draft state for modal interaction
  const [draftFilters, setDraftFilters] = useState<FilterState>(filters);

  // Calculate Target and Remaining Budget
  const { dailyCalories, tdee } = useMemo(() => calculateHealthTargets(userProfile), [userProfile]);
  const consumedCalories = MOCK_STATS.calories.current;
  const remainingBudget = Math.max(0, dailyCalories - consumedCalories);

  // Dynamic Macro & Price Calculation
  const dynamicMeal = useMemo(() => {
    if (!selectedMeal) return null;
    let price = selectedMeal.price;
    let calories = selectedMeal.calories ?? 0;
    const macros = { ...(selectedMeal.macros || { protein: 0, fat: 0, carbs: 0, sugar: 0, sodium: 0, fiber: 0 }) };

    if (baseOption === '飯量減半') {
      macros.carbs = Math.max(0, macros.carbs - 20);
      calories = Math.max(0, calories - 100);
    }

    if (extraOptions.includes('加蛋白質')) {
      price += 30;
      macros.protein += 15;
      calories += 80;
    }
    
    if (extraOptions.includes('增加蔬菜')) {
      price += 20;
      macros.fiber += 4;
    }

    return { ...selectedMeal, price, calories, macros };
  }, [selectedMeal, baseOption, extraOptions]);

  // Modal Health Warnings
  const mealWarnings = useMemo(() => {
    if (!dynamicMeal) return [];
    return generateHealthWarnings(dynamicMeal, { tdee }, consumedCalories);
  }, [dynamicMeal, tdee, consumedCalories]);

  // ==========================================
  // 推薦排序與過濾邏輯
  // ==========================================
  const recommendedMeals = useMemo(() => {
    return meals
      .filter(meal => {
        // 1. Existing Calorie Budget Logic
        const fitsCalorieBudget = meal.calories <= remainingBudget || meal.calories <= 400;

        // 2. Price Filter
        const fitsPrice = meal.price <= filters.maxPrice;

        // 3. Distance Filter
        const fitsDistance = meal.distance <= filters.maxDistance;

        // 4. High Protein (Assume > 25g is high)
        const fitsProtein = filters.onlyHighProtein ? meal.macros.protein >= 25 : true;

        // 5. Exclude Nuts (Simple keyword check in name since no ingredient list)
        const nutKeywords = ['堅果', '花生', '腰果', '杏仁', '核桃'];
        const hasNuts = filters.excludeNuts
          ? nutKeywords.some(keyword => meal.name.includes(keyword))
          : false;

        return fitsCalorieBudget && fitsPrice && fitsDistance && fitsProtein && !hasNuts;
      })
      .sort((a, b) => {
        // 排序公式：綜合分數 = (距離 * 權重) - 蛋白質含量
        const scoreA = (a.distance * 50) - a.macros.protein;
        const scoreB = (b.distance * 50) - b.macros.protein;
        return scoreA - scoreB;
      });
  }, [remainingBudget, meals, filters]);

  const handleNavigation = (meal: MealRecommendation) => {
    trackEvent('navigate_store', {
      mealId: meal.id,
      mealName: meal.name,
      storeName: meal.merchant
    });
    // Construct Google Maps Search URL
    const query = encodeURIComponent(`${meal.merchant} ${meal.name}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  const openFilterModal = () => {
    setDraftFilters(filters);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
  };

  const openMealModal = (meal: MealRecommendation) => {
    trackEvent('click_meal', {
      mealId: meal.id,
      mealName: meal.name,
      storeName: meal.merchant
    });
    setSelectedMeal(meal);
    setMealQuantity(1);
    setBaseOption('正常飯量');
    setFlavorOptions([]);
    setExtraOptions([]);
    setUserRemark('');
    setAddedSuccess(false);
    setIsAddingToCart(false);
  };

  const closeMealModal = () => {
    setSelectedMeal(null);
  };

  const handleAddToCart = () => {
    if (!dynamicMeal) return;
    setIsAddingToCart(true);

    // 1. Prepare product payload
    const customizations = [
      baseOption !== '正常飯量' ? baseOption : null, 
      ...flavorOptions, 
      ...extraOptions
    ].filter(Boolean) as string[];

    const newProduct = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: dynamicMeal.name,
      variant: `${dynamicMeal.calories ?? 0} kcal, P: ${dynamicMeal.macros?.protein ?? 0}g`,
      price: dynamicMeal.price,
      quantity: mealQuantity,
      imageUrl: dynamicMeal.imageUrl,
      macros: dynamicMeal.macros,
      customizations,
      userRemark
    };

    // 2. Read cart from localStorage
    let currentCart: any[] = [];
    try {
      const saved = localStorage.getItem('user_cart');
      if (saved) {
        currentCart = JSON.parse(saved);
        if (!Array.isArray(currentCart)) currentCart = [];
      } else {
        // If no cart exists, maybe we should seed it or just start empty.
        // We'll start empty since the user explicitly added an item.
      }
    } catch (e) {
      currentCart = [];
    }

    // 3. Find or create store
    let storeIndex = currentCart.findIndex((s: any) => s.storeName === dynamicMeal.merchant);
    if (storeIndex === -1) {
      currentCart.push({
        storeId: `s_${Date.now()}`,
        storeName: dynamicMeal.merchant,
        products: []
      });
      storeIndex = currentCart.length - 1;
    }

    // 4. Check if same product with same customizations exists
    const storeProducts = currentCart[storeIndex].products;
    const existingProductIndex = storeProducts.findIndex((p: any) => {
      if (p.name !== newProduct.name) return false;
      if (p.userRemark !== newProduct.userRemark) return false;
      
      const pCust = p.customizations || [];
      const newCust = newProduct.customizations || [];
      if (pCust.length !== newCust.length) return false;
      
      const sortedPCust = [...pCust].sort();
      const sortedNewCust = [...newCust].sort();
      return sortedPCust.every((val, index) => val === sortedNewCust[index]);
    });

    if (existingProductIndex !== -1) {
      // Merge quantity
      storeProducts[existingProductIndex].quantity += newProduct.quantity;
    } else {
      // Add new
      storeProducts.push(newProduct);
    }

    // 5. Save back to localStorage
    localStorage.setItem('user_cart', JSON.stringify(currentCart));

    // 6. Track event
    trackEvent('add_to_cart', {
      mealId: dynamicMeal.id,
      mealName: dynamicMeal.name,
      storeName: dynamicMeal.merchant,
      amount: dynamicMeal.price * mealQuantity,
      metadata: {
        quantity: mealQuantity,
        customizations,
        userRemark
      }
    });

    // 7. Show success state and close modal
    setAddedSuccess(true);
    setTimeout(() => {
      closeMealModal();
    }, 1200);
  };

  React.useEffect(() => {
    trackEvent('view_menu');
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto relative">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {ICONS.MealPlan} 智能飲食推薦
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
              剩餘熱量預算: {remainingBudget} kcal
            </span>
            {filters.onlyHighProtein && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                高蛋白
              </span>
            )}
            <span className="text-xs text-slate-400">
              (已過濾: &lt;${filters.maxPrice}, &lt;{filters.maxDistance}km)
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openFilterModal}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            調整偏好
          </button>
        </div>
      </header>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary-600" />
                篩選偏好
              </h3>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Price Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">預算上限</label>
                  <span className="text-primary-600 font-bold bg-primary-50 px-2 py-1 rounded text-sm">
                    ${draftFilters.maxPrice}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={draftFilters.maxPrice}
                  onChange={(e) => setDraftFilters({ ...draftFilters, maxPrice: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>$50</span>
                  <span>$500</span>
                </div>
              </div>

              {/* Distance Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">最大距離</label>
                  <span className="text-primary-600 font-bold bg-primary-50 px-2 py-1 rounded text-sm">
                    {draftFilters.maxDistance} km
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={draftFilters.maxDistance}
                  onChange={(e) => setDraftFilters({ ...draftFilters, maxDistance: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0.5 km</span>
                  <span>5.0 km</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-sm font-bold text-slate-700 mb-2 block">飲食偏好</label>

                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${draftFilters.onlyHighProtein ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {draftFilters.onlyHighProtein && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-sm font-medium text-slate-700">僅顯示高蛋白餐點 (&gt;25g)</span>
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={draftFilters.onlyHighProtein}
                    onChange={(e) => setDraftFilters({ ...draftFilters, onlyHighProtein: e.target.checked })}
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${draftFilters.excludeNuts ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {draftFilters.excludeNuts && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-sm font-medium text-slate-700">排除堅果類</span>
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={draftFilters.excludeNuts}
                    onChange={(e) => setDraftFilters({ ...draftFilters, excludeNuts: e.target.checked })}
                  />
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex gap-3">
              <button
                onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-3 text-slate-600 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 py-3 text-white font-bold bg-primary-600 rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all active:scale-95"
              >
                套用設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UI Display */}
      {recommendedMeals.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 border-dashed">
          <div className="text-4xl mb-4">🍽️</div>
          <h3 className="text-slate-600 font-bold">找不到符合條件的餐點</h3>
          <p className="text-slate-400 text-sm mt-2">請嘗試放寬篩選條件，例如增加預算或距離。</p>
          <button
            onClick={() => setFilters({ maxPrice: 500, maxDistance: 5, onlyHighProtein: false, excludeNuts: false })}
            className="mt-4 text-primary-600 font-medium hover:underline"
          >
            重置所有篩選
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedMeals.map((meal) => (
            <div 
              key={meal.id} 
              onClick={() => openMealModal(meal)}
              className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col cursor-pointer"
            >
              {/* Image Section */}
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <img
                  src={meal.imageUrl}
                  alt={meal.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500" />
                  {meal.distance} km
                </div>
                {meal.macros.protein > 30 && (
                  <div className="absolute top-3 left-3 bg-blue-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                    High Protein
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{meal.name}</h3>
                    <p className="text-slate-500 text-sm flex items-center gap-1">
                      {meal.merchant}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      ${meal.price}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      {ICONS.Delivery} 可外送
                    </div>
                  </div>
                </div>

                {/* Macros Tags */}
                <div className="flex gap-2 mb-4 text-xs font-semibold">
                  <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded">
                    🔥 {meal.calories} kcal
                  </span>
                  <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                    🥩 P: {meal.macros.protein}g
                  </span>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    C:{meal.macros.carbs}g F:{meal.macros.fat}g
                  </div>
                  <button
                    onClick={() => handleNavigation(meal)}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Navigation className="w-3 h-3" />
                    導航前往
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meal Detail Modal */}
      {selectedMeal && dynamicMeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header / Image - Fixed height */}
            <div className="relative h-48 bg-slate-100 flex-shrink-0">
              <img src={dynamicMeal.imageUrl} alt={dynamicMeal.name} className="w-full h-full object-cover" />
              <button 
                onClick={closeMealModal}
                className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-colors z-10"
                title="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 bg-white overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{dynamicMeal.name}</h3>
                  <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                    <Store className="w-4 h-4" /> {dynamicMeal.merchant}
                  </p>
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  ${dynamicMeal.price}
                </div>
              </div>

              {/* Nutrition Grid */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-3 text-center border-b border-gray-200 pb-2">詳細營養標示</h4>
                <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-center text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">熱量</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.calories ?? 0} <span className="text-[10px]">kcal</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">蛋白質</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.macros?.protein ?? 0} <span className="text-[10px]">g</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">碳水</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.macros?.carbs ?? 0} <span className="text-[10px]">g</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">脂肪</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.macros?.fat ?? 0} <span className="text-[10px]">g</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">糖</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.macros?.sugar ?? 0} <span className="text-[10px]">g</span></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">鈉</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.macros?.sodium ?? 0} <span className="text-[10px]">mg</span></span>
                  </div>
                  <div className="flex flex-col col-span-3 mt-1 pt-2 border-t border-gray-200">
                    <span className="text-gray-500 text-xs">膳食纖維</span>
                    <span className="font-bold text-teal-600">{dynamicMeal.macros?.fiber ?? 0} <span className="text-[10px]">g</span></span>
                  </div>
                </div>
              </div>

              {/* Customization Options */}
              <div className="mb-6 space-y-5">
                {/* 飯量/基底 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">飯量/基底 (單選)</h4>
                  <div className="flex flex-wrap gap-2">
                    {['正常飯量', '飯量減半', '換成糙米'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setBaseOption(opt)}
                        className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                          baseOption === opt 
                            ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 調味微調 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">調味微調</h4>
                  <div className="flex flex-wrap gap-2">
                    {['醬料分開', '少鹽', '少油', '去糖'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => {
                          setFlavorOptions(prev => 
                            prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                          flavorOptions.includes(opt)
                            ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 營養加料 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">營養加料</h4>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: '加蛋白質 (+$30, +15g P, +80kcal)', val: '加蛋白質' },
                      { label: '增加蔬菜 (+$20, +4g Fiber)', val: '增加蔬菜' }
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors ${extraOptions.includes(opt.val) ? 'border-teal-500 bg-teal-50/30' : 'border-gray-200'}`}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-teal-500 cursor-pointer rounded border-gray-300 focus:ring-teal-500 focus:ring-2"
                          checked={extraOptions.includes(opt.val)}
                          onChange={(e) => {
                            if (e.target.checked) setExtraOptions(prev => [...prev, opt.val]);
                            else setExtraOptions(prev => prev.filter(x => x !== opt.val));
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700 flex-1">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 自訂備註 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">自訂備註</h4>
                  <input
                    type="text"
                    value={userRemark}
                    onChange={(e) => setUserRemark(e.target.value)}
                    placeholder="例如：不加蔥、白飯不要太軟..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Health Warnings */}
              {mealWarnings.length > 0 && (
                <div className="mb-6 space-y-2">
                  {mealWarnings.map((warning, idx) => (
                    <div key={idx} className={`text-sm flex items-start gap-2 p-3 border rounded-xl ${
                      warning.type === 'danger' ? 'bg-red-50 text-red-600 border-red-100' :
                      warning.type === 'warning' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                      warning.type === 'info' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                      'bg-slate-50 text-slate-600 border-slate-100'
                    }`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="font-medium">{warning.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Footer Always visible */}
              <div className="pt-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1 shrink-0">
                    <button 
                      onClick={() => setMealQuantity(Math.max(1, mealQuantity - 1))}
                      className="p-3 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="w-8 text-center font-bold text-slate-700">{mealQuantity}</div>
                    <button 
                      onClick={() => setMealQuantity(mealQuantity + 1)}
                      className="p-3 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <button 
                    onClick={handleAddToCart}
                    disabled={isAddingToCart}
                    className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                      addedSuccess 
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                        : 'bg-teal-500 hover:bg-teal-600 text-white shadow-teal-500/30 active:scale-95'
                    }`}
                  >
                    {addedSuccess ? (
                      <>
                        <Check className="w-5 h-5" />已加入購物車
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        加入購物車 - ${(dynamicMeal.price * mealQuantity).toLocaleString()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};