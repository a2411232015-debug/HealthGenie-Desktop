import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Info,
  MapPin,
  Minus,
  Navigation,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react';
import { ICONS, MOCK_STATS } from '../constants';
import { Cart, CartItem, MealRecommendation, SelectedOptionSnapshot, UserProfile } from '../types';
import { getCart, getMerchant, saveCart } from '../data/repository';
import { calculateHealthTargets, generateHealthWarnings } from '../utils/health';
import { formatNutritionValue, hasNutritionData, toSafeNumber } from '../utils/numbers';
import {
  calculateCartItem,
  calculatePriceBreakdown,
  calculateUnitNutrition,
  createSelectedOptionSnapshot,
  formatCurrency,
  productNutrition,
} from '../utils/pricing';
import { showToast } from '../utils/notifications';
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

type SelectionMap = Record<string, string[]>;

const selectionKey = (item: CartItem): string =>
  `${item.productId}|${item.selectedOptions.map((option) => option.optionId).sort().join(',')}|${item.userRemark || ''}`;

export const MealPlan: React.FC<MealPlanProps> = ({ userProfile, meals }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealRecommendation | null>(null);
  const [mealQuantity, setMealQuantity] = useState(1);
  const [selections, setSelections] = useState<SelectionMap>({});
  const [userRemark, setUserRemark] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [pendingReplacement, setPendingReplacement] = useState<CartItem | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    maxPrice: 300,
    maxDistance: 3,
    onlyHighProtein: false,
    excludeNuts: false,
  });
  const [draftFilters, setDraftFilters] = useState(filters);

  const { dailyCalories, tdee } = useMemo(() => calculateHealthTargets(userProfile), [userProfile]);
  const consumedCalories = MOCK_STATS.calories.current;
  const remainingBudget = Math.max(0, dailyCalories - consumedCalories);

  const merchant = selectedMeal ? getMerchant(selectedMeal.merchantId) : undefined;
  const selectedSnapshots = useMemo<SelectedOptionSnapshot[]>(() => {
    if (!selectedMeal) return [];
    return selectedMeal.optionGroups.flatMap((group) =>
      (selections[group.id] || []).flatMap((optionId) => {
        const option = group.options.find((candidate) => candidate.id === optionId);
        return option ? [createSelectedOptionSnapshot(group.id, group.name, option)] : [];
      }),
    );
  }, [selectedMeal, selections]);

  const dynamicValues = useMemo(() => {
    if (!selectedMeal) return null;
    const baseNutrition = productNutrition(selectedMeal);
    return {
      price: calculatePriceBreakdown(selectedMeal.price, selectedSnapshots),
      nutrition: calculateUnitNutrition(baseNutrition, selectedSnapshots),
    };
  }, [selectedMeal, selectedSnapshots]);

  const mealWarnings = useMemo(() => {
    if (!dynamicValues) return [];
    return generateHealthWarnings(
      { calories: dynamicValues.nutrition.calories, macros: dynamicValues.nutrition },
      { tdee },
      consumedCalories,
    );
  }, [dynamicValues, tdee]);

  const recommendedMeals = useMemo(() => meals
    .filter((meal) => {
      const calories = toSafeNumber(meal.calories);
      const protein = toSafeNumber(meal.macros?.protein);
      const fitsCalorieBudget = calories <= remainingBudget || calories <= 400;
      const fitsPrice = toSafeNumber(meal.price) <= filters.maxPrice;
      const fitsDistance = toSafeNumber(meal.distance) <= filters.maxDistance;
      const fitsProtein = filters.onlyHighProtein ? protein >= 25 : true;
      const nutKeywords = ['堅果', '花生', '腰果', '杏仁', '核桃'];
      const hasNuts = filters.excludeNuts && nutKeywords.some((keyword) => meal.name.includes(keyword));
      return fitsCalorieBudget && fitsPrice && fitsDistance && fitsProtein && !hasNuts;
    })
    .sort((a, b) =>
      (toSafeNumber(a.distance) * 50 - toSafeNumber(a.macros?.protein)) -
      (toSafeNumber(b.distance) * 50 - toSafeNumber(b.macros?.protein)),
    ), [remainingBudget, meals, filters]);

  const openMealModal = (meal: MealRecommendation) => {
    if (!meal.available) {
      showToast('此餐點已售完', 'error');
      return;
    }
    const store = getMerchant(meal.merchantId);
    if (store?.acceptingOrders === false) {
      showToast('店家目前暫停接單', 'error');
      return;
    }
    trackEvent('click_meal', { mealId: meal.id, mealName: meal.name, storeName: meal.merchant });
    setSelectedMeal(meal);
    setMealQuantity(1);
    setSelections({});
    setUserRemark('');
    setValidationErrors({});
  };

  const closeMealModal = () => {
    setSelectedMeal(null);
    setValidationErrors({});
  };

  const toggleOption = (groupId: string, optionId: string) => {
    if (!selectedMeal) return;
    const group = selectedMeal.optionGroups.find((candidate) => candidate.id === groupId);
    const option = group?.options.find((candidate) => candidate.id === optionId);
    if (!group || !option || !option.available) return;
    setSelections((current) => {
      const selected = current[groupId] || [];
      if (group.type === 'single') return { ...current, [groupId]: [optionId] };
      if (selected.includes(optionId)) {
        return { ...current, [groupId]: selected.filter((id) => id !== optionId) };
      }
      if (selected.length >= group.maxSelect) {
        showToast(`${group.name}最多選擇 ${group.maxSelect} 項`, 'error');
        return current;
      }
      return { ...current, [groupId]: [...selected, optionId] };
    });
    setValidationErrors((current) => ({ ...current, [groupId]: '' }));
  };

  const validateSelections = (): boolean => {
    if (!selectedMeal) return false;
    const errors: Record<string, string> = {};
    for (const group of selectedMeal.optionGroups) {
      const count = selections[group.id]?.length || 0;
      if (count < group.minSelect || (group.required && count === 0)) {
        errors[group.id] = `請選擇${group.name}`;
      } else if (count > group.maxSelect) {
        errors[group.id] = `${group.name}最多選擇 ${group.maxSelect} 項`;
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildCartItem = (): CartItem | null => {
    if (!selectedMeal || !dynamicValues || !validateSelections()) return null;
    return calculateCartItem({
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId: selectedMeal.id,
      merchantId: selectedMeal.merchantId,
      merchantName: selectedMeal.merchant,
      name: selectedMeal.name,
      imageUrl: selectedMeal.imageUrl,
      quantity: mealQuantity,
      basePrice: selectedMeal.price,
      baseNutrition: productNutrition(selectedMeal),
      selectedOptions: selectedSnapshots,
      priceBreakdown: dynamicValues.price,
      unitNutrition: dynamicValues.nutrition,
      userRemark: userRemark.trim(),
    });
  };

  const addItemToCart = (item: CartItem, replace = false) => {
    const current = replace ? { merchantId: null, merchantName: '', items: [] } as Cart : getCart();
    const key = selectionKey(item);
    const existingIndex = current.items.findIndex((candidate) => selectionKey(candidate) === key);
    const items = [...current.items];
    if (existingIndex >= 0) {
      items[existingIndex] = { ...items[existingIndex], quantity: items[existingIndex].quantity + item.quantity };
    } else {
      items.push(item);
    }
    const next: Cart = {
      merchantId: item.merchantId,
      merchantName: item.merchantName,
      items,
    };
    if (!saveCart(next)) {
      showToast('購物車儲存失敗，請稍後再試', 'error');
      return;
    }
    trackEvent('add_to_cart', {
      mealId: item.productId,
      mealName: item.name,
      storeName: item.merchantName,
      amount: item.priceBreakdown.unitPrice * item.quantity,
      metadata: {
        quantity: item.quantity,
        optionIds: item.selectedOptions.map((option) => option.optionId),
      },
    });
    showToast(replace ? '已清空原購物車並加入餐點' : '已加入購物車');
    setPendingReplacement(null);
    closeMealModal();
  };

  const handleAddToCart = () => {
    if (!selectedMeal?.available) {
      showToast('此餐點已售完', 'error');
      return;
    }
    if (getMerchant(selectedMeal.merchantId)?.acceptingOrders === false) {
      showToast('店家目前暫停接單', 'error');
      return;
    }
    const item = buildCartItem();
    if (!item) return;
    const current = getCart();
    if (current.items.length > 0 && current.merchantId !== item.merchantId) {
      setPendingReplacement(item);
      return;
    }
    addItemToCart(item);
  };

  const handleNavigation = (event: React.MouseEvent, meal: MealRecommendation) => {
    event.stopPropagation();
    trackEvent('navigate_store', { mealId: meal.id, mealName: meal.name, storeName: meal.merchant });
    const query = encodeURIComponent(`${meal.merchant} ${meal.name}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  };

  const nutritionWasProvided = selectedMeal
    ? hasNutritionData(selectedMeal.calories, selectedMeal.macros)
    : false;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto relative">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {ICONS.MealPlan} 智能飲食推薦
          </h1>
          <p className="text-slate-500 mt-1">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
              剩餘熱量預算：{remainingBudget} kcal
            </span>
          </p>
        </div>
        <button
          onClick={() => { setDraftFilters(filters); setIsFilterOpen(true); }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          調整偏好
        </button>
      </header>

      {recommendedMeals.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 border-dashed">
          <div className="text-4xl mb-4">🍽️</div>
          <h3 className="text-slate-600 font-bold">找不到符合條件的餐點</h3>
          <button
            onClick={() => setFilters({ maxPrice: 500, maxDistance: 5, onlyHighProtein: false, excludeNuts: false })}
            className="mt-4 text-teal-600 font-bold hover:underline"
          >
            重置所有篩選
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedMeals.map((meal) => {
            const storePaused = getMerchant(meal.merchantId)?.acceptingOrders === false;
            const unavailable = !meal.available || storePaused;
            return (
              <article
                key={meal.id}
                onClick={() => openMealModal(meal)}
                className={`group bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all flex flex-col ${
                  unavailable ? 'cursor-not-allowed opacity-65' : 'cursor-pointer hover:shadow-xl hover:shadow-emerald-500/10'
                }`}
              >
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  <img src={meal.imageUrl} alt={meal.name} className={`w-full h-full object-cover ${unavailable ? 'grayscale' : 'group-hover:scale-110 transition-transform duration-700'}`} />
                  <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500" /> {toSafeNumber(meal.distance)} km
                  </div>
                  {unavailable && (
                    <div className="absolute inset-0 bg-slate-900/45 flex items-center justify-center">
                      <span className="bg-slate-900 text-white font-black px-4 py-2 rounded-xl">
                        {storePaused ? '暫停接單' : '已售完'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{meal.name}</h3>
                      <p className="text-slate-500 text-sm">{meal.merchant}</p>
                    </div>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      {formatCurrency(meal.price)}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-4 text-xs font-semibold">
                    <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded">
                      🔥 {formatNutritionValue(meal.calories, 'kcal')}
                    </span>
                    <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                      🥩 {formatNutritionValue(meal.macros?.protein, 'g')}
                    </span>
                  </div>
                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      碳水 {formatNutritionValue(meal.macros?.carbs, 'g')}
                    </span>
                    <button
                      onClick={(event) => handleNavigation(event, meal)}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Navigation className="w-3 h-3" /> 導航前往
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">篩選偏好</h3>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <label className="block text-sm font-bold text-slate-700">
                預算上限：{formatCurrency(draftFilters.maxPrice)}
                <input type="range" min="50" max="500" step="10" value={draftFilters.maxPrice} onChange={(event) => setDraftFilters({ ...draftFilters, maxPrice: Number(event.target.value) })} className="w-full mt-2 accent-teal-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                最大距離：{draftFilters.maxDistance} km
                <input type="range" min="0.5" max="5" step="0.1" value={draftFilters.maxDistance} onChange={(event) => setDraftFilters({ ...draftFilters, maxDistance: Number(event.target.value) })} className="w-full mt-2 accent-teal-500" />
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={draftFilters.onlyHighProtein} onChange={(event) => setDraftFilters({ ...draftFilters, onlyHighProtein: event.target.checked })} className="accent-teal-500" />
                僅顯示高蛋白餐點（≥25g）
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={draftFilters.excludeNuts} onChange={(event) => setDraftFilters({ ...draftFilters, excludeNuts: event.target.checked })} className="accent-teal-500" />
                排除堅果類
              </label>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3 rounded-b-2xl">
              <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold">取消</button>
              <button onClick={() => { setFilters(draftFilters); setIsFilterOpen(false); }} className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-bold">套用設定</button>
            </div>
          </div>
        </div>
      )}

      {selectedMeal && dynamicValues && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
            <div className="relative h-48 shrink-0">
              <img src={selectedMeal.imageUrl} alt={selectedMeal.name} className="w-full h-full object-cover" />
              <button onClick={closeMealModal} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{selectedMeal.name}</h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Store className="w-4 h-4" /> {selectedMeal.merchant}</p>
                </div>
                <span className="text-2xl font-black text-teal-600">{formatCurrency(dynamicValues.price.unitPrice)}</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 my-5">
                <h4 className="text-sm font-bold text-slate-700 mb-3">詳細營養標示</h4>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  {[
                    ['熱量', 'calories', 'kcal'],
                    ['蛋白質', 'protein', 'g'],
                    ['脂肪', 'fat', 'g'],
                    ['碳水', 'carbs', 'g'],
                    ['膳食纖維', 'fiber', 'g'],
                    ['鈉', 'sodium', 'mg'],
                  ].map(([label, key, unit]) => (
                    <div key={key}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-bold text-teal-600 mt-1">
                        {nutritionWasProvided
                          ? formatNutritionValue(dynamicValues.nutrition[key as keyof typeof dynamicValues.nutrition], unit)
                          : '尚未提供'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                {selectedMeal.optionGroups.map((group) => (
                  <fieldset key={group.id}>
                    <legend className="text-sm font-bold text-slate-800">
                      {group.name}
                      <span className="text-xs font-medium text-slate-400 ml-2">
                        {group.required ? '必選' : '選填'} · {group.type === 'single' ? '單選' : `最多 ${group.maxSelect} 項`}
                      </span>
                    </legend>
                    <div className="mt-2 space-y-2">
                      {group.options.map((option) => {
                        const checked = (selections[group.id] || []).includes(option.id);
                        return (
                          <label key={option.id} className={`flex items-center gap-3 p-3 border rounded-xl ${option.available ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                            <input
                              type={group.type === 'single' ? 'radio' : 'checkbox'}
                              name={group.type === 'single' ? group.id : undefined}
                              checked={checked}
                              disabled={!option.available}
                              onChange={() => toggleOption(group.id, option.id)}
                              className="accent-teal-500"
                            />
                            <span className="flex-1 text-sm font-medium">{option.name}{!option.available && '（已停售）'}</span>
                            <span className="text-sm font-bold text-teal-600">
                              {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : '+NT$0'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {validationErrors[group.id] && <p className="text-red-500 text-xs mt-1.5">{validationErrors[group.id]}</p>}
                  </fieldset>
                ))}
                <div>
                  <label className="text-sm font-bold text-slate-800" htmlFor="meal-remark">備註（最多 100 字）</label>
                  <input id="meal-remark" value={userRemark} maxLength={100} onChange={(event) => setUserRemark(event.target.value)} className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="例如：不加蔥、醬料分開" />
                  <p className="text-xs text-right text-slate-400 mt-1">{userRemark.length}/100</p>
                </div>
              </div>

              {mealWarnings.length > 0 && (
                <div className="my-5 space-y-2">
                  {mealWarnings.map((warning, index) => (
                    <div key={index} className={`text-sm flex gap-2 p-3 border rounded-xl ${warning.type === 'danger' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-orange-50 border-orange-100 text-orange-600'}`}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {warning.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 flex items-center gap-3">
                <div className="flex items-center border border-slate-200 rounded-xl">
                  <button onClick={() => setMealQuantity(Math.max(1, mealQuantity - 1))} className="p-3 text-slate-500"><Minus className="w-5 h-5" /></button>
                  <span className="w-8 text-center font-bold">{mealQuantity}</span>
                  <button onClick={() => setMealQuantity(mealQuantity + 1)} className="p-3 text-slate-500"><Plus className="w-5 h-5" /></button>
                </div>
                <button onClick={handleAddToCart} className="flex-1 py-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-black flex justify-center items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  加入購物車 · {formatCurrency(dynamicValues.price.unitPrice * mealQuantity)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingReplacement && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-amber-500 mb-3"><AlertTriangle className="w-10 h-10" /></div>
            <h3 className="text-xl font-black text-slate-900">購物車已有其他商家的餐點</h3>
            <p className="text-slate-600 mt-3 leading-relaxed">
              一次訂單只能購買同一家商家的餐點。<br />
              是否清空目前購物車，改為加入此商家的餐點？
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPendingReplacement(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">取消</button>
              <button onClick={() => addItemToCart(pendingReplacement, true)} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold">清空並加入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
