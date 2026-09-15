import React, { useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Phone,
  Save,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { ICONS } from '../constants';
import { MealRecommendation, Merchant, OptionGroup } from '../types';
import { getMerchant, saveMerchant } from '../data/repository';
import { formatCurrency } from '../utils/pricing';
import { showToast } from '../utils/notifications';
import { MerchantOrderManagement } from './MerchantOrderManagement';
import { MerchantAnalyticsView } from './MerchantAnalyticsView';
import { newOptionGroup, OptionGroupEditor } from './OptionGroupEditor';

interface AdminPanelProps {
  meals: MealRecommendation[];
  onAddMeal: (meal: MealRecommendation) => void;
  onUpdateMeal: (meal: MealRecommendation) => void;
  onDeleteMeal: (mealId: string) => void;
  onBack: () => void;
}

type AdminView = 'analytics' | 'menu' | 'store' | 'orders';
type MenuMode = 'manual' | 'ai';

interface MealForm {
  name: string;
  price: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  sodium: string;
  imageUrl: string;
  optionGroups: OptionGroup[];
}

const MERCHANT_ID = 'merchant_self';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';

const emptyMealForm = (): MealForm => ({
  name: '',
  price: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  fiber: '',
  sodium: '',
  imageUrl: DEFAULT_IMAGE,
  optionGroups: [],
});

const numberOrUndefined = (value: string): number | undefined =>
  value.trim() === '' ? undefined : Number(value);

const validatePhone = (phone: string): boolean =>
  /^(?:0\d{1,2}-?\d{6,8}|09\d{2}-?\d{3}-?\d{3})$/.test(phone.replace(/\s/g, ''));

export const AdminPanel: React.FC<AdminPanelProps> = ({
  meals,
  onAddMeal,
  onUpdateMeal,
  onDeleteMeal,
  onBack,
}) => {
  const initialMerchant = getMerchant(MERCHANT_ID) || {
    id: MERCHANT_ID,
    name: '我的健康餐盒',
    phone: '02-2345-6789',
    address: '台北市信義區信義路五段7號',
    lat: 25.033,
    lng: 121.5654,
    hours: '11:00 - 20:30',
    deliveryFee: 30,
    serviceFee: 15,
    discount: 15,
    acceptingOrders: true,
  };
  const [currentView, setCurrentView] = useState<AdminView>('menu');
  const [storeProfile, setStoreProfile] = useState<Merchant>(initialMerchant);
  const [storeErrors, setStoreErrors] = useState<Record<string, string>>({});
  const [menuMode, setMenuMode] = useState<MenuMode>('manual');
  const [importUrl, setImportUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MealForm>(emptyMealForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const merchantMeals = useMemo(
    () => meals.filter((meal) => meal.merchantId === MERCHANT_ID),
    [meals],
  );

  const validateStore = (): boolean => {
    const errors: Record<string, string> = {};
    if (storeProfile.name.trim().length < 2) errors.name = '商店名稱至少 2 個字';
    if (!validatePhone(storeProfile.phone)) errors.phone = '請輸入合法的電話號碼';
    if (!storeProfile.address.trim()) errors.address = '地址為必填';
    if (storeProfile.lat < -90 || storeProfile.lat > 90) errors.lat = '緯度須介於 -90 至 90';
    if (storeProfile.lng < -180 || storeProfile.lng > 180) errors.lng = '經度須介於 -180 至 180';
    setStoreErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveStore = () => {
    if (!validateStore()) return;
    if (!saveMerchant(storeProfile)) {
      showToast('店家資訊儲存失敗，請稍後再試', 'error');
      return;
    }
    merchantMeals.forEach((meal) => {
      if (meal.merchant !== storeProfile.name) onUpdateMeal({ ...meal, merchant: storeProfile.name });
    });
    showToast('店家資訊已更新');
  };

  const toggleAcceptingOrders = () => {
    const next = { ...storeProfile, acceptingOrders: !storeProfile.acceptingOrders };
    if (saveMerchant(next)) {
      setStoreProfile(next);
      showToast(next.acceptingOrders ? '店家已恢復接單' : '店家已暫停接單');
    } else showToast('接單狀態儲存失敗', 'error');
  };

  const startEdit = (meal: MealRecommendation) => {
    setEditingId(meal.id);
    setMenuMode('manual');
    setForm({
      name: meal.name,
      price: String(meal.price),
      calories: meal.calories === undefined ? '' : String(meal.calories),
      protein: meal.macros?.protein === undefined ? '' : String(meal.macros.protein),
      fat: meal.macros?.fat === undefined ? '' : String(meal.macros.fat),
      carbs: meal.macros?.carbs === undefined ? '' : String(meal.macros.carbs),
      fiber: meal.macros?.fiber === undefined ? '' : String(meal.macros.fiber),
      sodium: meal.macros?.sodium === undefined ? '' : String(meal.macros.sodium),
      imageUrl: meal.imageUrl || DEFAULT_IMAGE,
      optionGroups: JSON.parse(JSON.stringify(meal.optionGroups)) as OptionGroup[],
    });
    setFormErrors({});
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyMealForm());
    setFormErrors({});
    setImportUrl('');
  };

  const validateMeal = (): boolean => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) errors.name = '餐點名稱為必填';
    else if (name.length < 2 || name.length > 50) errors.name = '餐點名稱須為 2～50 字';
    if (form.price.trim() === '') errors.price = '價格為必填';
    else if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) errors.price = '價格須大於或等於 NT$0';
    (['calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium'] as const).forEach((field) => {
      if (form[field] !== '' && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) {
        errors[field] = '數值須大於或等於 0';
      }
    });
    form.optionGroups.forEach((group) => {
      if (!group.name.trim()) errors[`group_${group.id}`] = '請輸入群組名稱';
      else if (group.options.length === 0) errors[`group_${group.id}`] = '每個群組至少需要一個選項';
      else if (group.options.some((option) => !option.name.trim())) errors[`group_${group.id}`] = '請填寫所有選項名稱';
      else if (group.minSelect < 0 || group.maxSelect < 1 || group.minSelect > group.maxSelect) errors[`group_${group.id}`] = '最少／最多選擇數設定不合法';
      else if (group.required && group.minSelect < 1) errors[`group_${group.id}`] = '必選群組的最少選擇數至少為 1';
      else if (group.maxSelect > group.options.length) errors[`group_${group.id}`] = '最多選擇數不可超過選項數量';
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateMeal()) return;
    const existing = editingId ? meals.find((meal) => meal.id === editingId) : undefined;
    const meal: MealRecommendation = {
      id: editingId || `meal_${Date.now()}`,
      merchantId: MERCHANT_ID,
      merchant: storeProfile.name,
      name: form.name.trim(),
      distance: existing?.distance ?? 0.5,
      price: Number(form.price),
      calories: numberOrUndefined(form.calories),
      macros: {
        protein: numberOrUndefined(form.protein),
        fat: numberOrUndefined(form.fat),
        carbs: numberOrUndefined(form.carbs),
        fiber: numberOrUndefined(form.fiber),
        sodium: numberOrUndefined(form.sodium),
        sugar: existing?.macros?.sugar,
      },
      imageUrl: form.imageUrl,
      available: existing?.available ?? true,
      optionGroups: JSON.parse(JSON.stringify(form.optionGroups)) as OptionGroup[],
    };
    if (editingId) {
      onUpdateMeal(meal);
      showToast('餐點資料已儲存');
    } else {
      onAddMeal(meal);
      showToast('餐點已上架');
    }
    resetForm();
  };

  const handleDelete = (mealId: string) => {
    if (!window.confirm('確定要刪除此餐點嗎？刪除後無法復原。')) return;
    onDeleteMeal(mealId);
    if (editingId === mealId) resetForm();
    showToast('餐點已刪除');
  };

  const toggleAvailability = (meal: MealRecommendation) => {
    onUpdateMeal({ ...meal, available: !meal.available });
    showToast(!meal.available ? '餐點已恢復供應' : '餐點已設為售完');
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('圖片格式錯誤，請選擇圖片檔案', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('圖片上傳失敗，檔案需小於 10MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, imageUrl: String(reader.result || DEFAULT_IMAGE) }));
    reader.onerror = () => showToast('圖片上傳失敗，請重新選擇圖片', 'error');
    reader.readAsDataURL(file);
  };

  const handleAiImport = () => {
    if (!/^https?:\/\//i.test(importUrl.trim())) {
      setFormErrors({ importUrl: '請輸入合法的 http/https 網址' });
      return;
    }
    setIsAnalyzing(true);
    setFormErrors({});
    window.setTimeout(() => {
      setForm({
        name: '特製藜麥舒肥嫩雞',
        price: '180',
        calories: '485',
        protein: '42',
        fat: '12',
        carbs: '45',
        fiber: '6',
        sodium: '480',
        imageUrl: DEFAULT_IMAGE,
        optionGroups: [
          { ...newOptionGroup(), name: '飯量', required: true, minSelect: 1 },
          { ...newOptionGroup(), name: '加料', type: 'multiple', maxSelect: 2 },
        ],
      });
      setIsAnalyzing(false);
      setMenuMode('manual');
      showToast('AI 匯入完成，請核對後再上架', 'info');
    }, 900);
  };

  const sidebarButton = (view: AdminView, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === view ? 'bg-teal-500 text-white font-bold' : 'hover:bg-slate-800'}`}
    >
      {icon} {label}
    </button>
  );

  const renderStore = () => (
    <div className="max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">店家基本資訊</h2>
          <p className="text-sm text-slate-500 mt-1">費用與營業狀態會同步到顧客結帳頁</p>
        </div>
        <button onClick={toggleAcceptingOrders} className={`px-4 py-2 rounded-xl font-bold ${storeProfile.acceptingOrders ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {storeProfile.acceptingOrders ? '接單中' : '暫停接單'}
        </button>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5">
        <div>
          <label className="font-bold text-slate-700">商店名稱</label>
          <input value={storeProfile.name} onChange={(event) => setStoreProfile({ ...storeProfile, name: event.target.value })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
          {storeErrors.name && <p className="text-red-500 text-xs mt-1">{storeErrors.name}</p>}
        </div>
        <div>
          <label className="font-bold text-slate-700 flex items-center gap-2"><Phone className="w-4 h-4" /> 聯絡電話</label>
          <input value={storeProfile.phone} onChange={(event) => setStoreProfile({ ...storeProfile, phone: event.target.value })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
          {storeErrors.phone && <p className="text-red-500 text-xs mt-1">{storeErrors.phone}</p>}
        </div>
        <div>
          <label className="font-bold text-slate-700">營業地址</label>
          <input value={storeProfile.address} onChange={(event) => setStoreProfile({ ...storeProfile, address: event.target.value })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
          {storeErrors.address && <p className="text-red-500 text-xs mt-1">{storeErrors.address}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-slate-700">緯度</label>
            <input type="number" value={storeProfile.lat} onChange={(event) => setStoreProfile({ ...storeProfile, lat: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
            {storeErrors.lat && <p className="text-red-500 text-xs mt-1">{storeErrors.lat}</p>}
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700">經度</label>
            <input type="number" value={storeProfile.lng} onChange={(event) => setStoreProfile({ ...storeProfile, lng: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
            {storeErrors.lng && <p className="text-red-500 text-xs mt-1">{storeErrors.lng}</p>}
          </div>
        </div>
        <div>
          <label className="font-bold text-slate-700">營業時間</label>
          <input value={storeProfile.hours} onChange={(event) => setStoreProfile({ ...storeProfile, hours: event.target.value })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['deliveryFee', '外送費'],
            ['serviceFee', '服務費'],
            ['discount', '優惠折抵'],
          ].map(([field, label]) => (
            <label key={field} className="text-sm font-bold text-slate-700">{label}
              <input type="number" min="0" value={storeProfile[field as keyof Merchant] as number} onChange={(event) => setStoreProfile({ ...storeProfile, [field]: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
            </label>
          ))}
        </div>
        <button onClick={handleSaveStore} className="w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
          <Save className="w-5 h-5" /> 更新店家資訊
        </button>
      </div>
    </div>
  );

  const field = (
    id: keyof Pick<MealForm, 'name' | 'price' | 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sodium'>,
    label: string,
    type: 'text' | 'number' = 'number',
  ) => (
    <div>
      <label htmlFor={`meal-${id}`} className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      <input
        id={`meal-${id}`}
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={form[id]}
        onChange={(event) => setForm({ ...form, [id]: event.target.value })}
        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm"
      />
      {formErrors[id] && <p className="text-red-500 text-xs mt-1">{formErrors[id]}</p>}
    </div>
  );

  const renderMenu = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">菜單管理</h2>
        <div className="bg-white p-1 rounded-lg border border-slate-200 flex">
          <button onClick={() => setMenuMode('manual')} className={`px-4 py-2 rounded-md text-sm font-bold ${menuMode === 'manual' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>手動輸入</button>
          <button onClick={() => setMenuMode('ai')} className={`px-4 py-2 rounded-md text-sm font-bold ${menuMode === 'ai' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}>AI 智慧匯入</button>
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-7">
        <div className="xl:col-span-3">
          {menuMode === 'ai' ? (
            <section className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 p-8 rounded-2xl text-center">
              {isAnalyzing ? (
                <div className="py-10"><Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto" /><h3 className="font-bold text-purple-900 mt-4">正在解析餐點與營養資料……</h3></div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-purple-900">貼上外送平台或官方網站連結</h3>
                  <div className="flex gap-2 mt-6">
                    <input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://..." className="flex-1 p-3 border border-purple-200 rounded-xl" />
                    <button onClick={handleAiImport} className="bg-purple-600 text-white px-5 rounded-xl font-bold">開始解析</button>
                  </div>
                  {formErrors.importUrl && <p className="text-red-500 text-xs text-left mt-1">{formErrors.importUrl}</p>}
                </>
              )}
            </section>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
              <h3 className="font-bold text-slate-800">{editingId ? '編輯餐點' : '新增餐點'}</h3>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">餐點圖片</label>
                <div className="border-2 border-dashed border-teal-200 rounded-xl p-4">
                  <img src={form.imageUrl} alt="餐點預覽" className="w-full h-36 object-cover rounded-lg bg-slate-100" />
                  <label className="mt-3 mx-auto w-max cursor-pointer bg-teal-50 text-teal-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4" /> 從裝置上傳
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>
              {field('name', '餐點名稱（2～50 字）', 'text')}
              <div className="grid grid-cols-2 gap-4">
                {field('price', '基本價格 NT$')}
                {field('calories', '熱量 kcal')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl">
                {field('protein', '蛋白質 g')}
                {field('fat', '脂肪 g')}
                {field('carbs', '碳水 g')}
                {field('fiber', '膳食纖維 g')}
                {field('sodium', '鈉 mg')}
              </div>
              <OptionGroupEditor groups={form.optionGroups} onChange={(optionGroups) => setForm({ ...form, optionGroups })} errors={formErrors} />
              <div className="flex gap-3">
                {editingId && <button type="button" onClick={resetForm} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">取消編輯</button>}
                <button type="submit" className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-bold">{editingId ? '儲存修改' : '確認上架'}</button>
              </div>
            </form>
          )}
        </div>

        <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-max">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between">
            <h3 className="font-bold text-slate-700">已上架餐點庫</h3>
            <span className="text-xs text-slate-500">Total: {merchantMeals.length}</span>
          </div>
          <div className="p-3 space-y-3 max-h-[760px] overflow-y-auto">
            {merchantMeals.length === 0 && <p className="text-center text-slate-400 py-10">尚未上架餐點</p>}
            {merchantMeals.map((meal) => (
              <article key={meal.id} onClick={() => startEdit(meal)} className={`p-3 border rounded-xl cursor-pointer ${editingId === meal.id ? 'border-teal-500 bg-teal-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <div className="flex gap-3">
                  <img src={meal.imageUrl} alt={meal.name} className={`w-16 h-16 rounded-lg object-cover ${meal.available ? '' : 'grayscale opacity-60'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{meal.name}</h4>
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleDelete(meal.id); }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{formatCurrency(meal.price)} · {meal.calories === undefined ? '尚未提供熱量' : `${meal.calories} kcal`}</p>
                    <button type="button" onClick={(event) => { event.stopPropagation(); toggleAvailability(meal); }} className={`mt-2 px-2 py-1 rounded-md text-xs font-bold ${meal.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {meal.available ? '供應中' : '已售完'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-slate-300 fixed left-0 top-0 h-full p-5 flex flex-col z-20">
        <div className="text-white font-black text-xl flex items-center gap-2 px-2 py-4">{ICONS.Admin} 商家後台</div>
        <nav className="mt-6 space-y-2">
          {sidebarButton('analytics', '數據總覽', ICONS.Analytics)}
          {sidebarButton('menu', '菜單管理', ICONS.MealPlan)}
          {sidebarButton('orders', '訂單管理', ICONS.Orders)}
          {sidebarButton('store', '店家資訊', <Store className="w-5 h-5" />)}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-4">
          <button onClick={onBack} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-800 rounded-xl">{ICONS.Logout} 返回 App</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8 min-w-0">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800">HealthGenie Merchant</h1>
            <p className="text-slate-400 text-sm mt-1">歡迎回來，{storeProfile.name}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${storeProfile.acceptingOrders ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {storeProfile.acceptingOrders ? '接單中' : '暫停接單'}
          </span>
        </header>
        {currentView === 'analytics' && <MerchantAnalyticsView merchantId={MERCHANT_ID} />}
        {currentView === 'menu' && renderMenu()}
        {currentView === 'orders' && <MerchantOrderManagement merchantId={MERCHANT_ID} />}
        {currentView === 'store' && renderStore()}
      </main>
    </div>
  );
};
