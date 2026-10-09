import React, { useState } from 'react';
import { AlertTriangle, Minus, Plus, ShoppingBag, Store, Trash2, UtensilsCrossed } from 'lucide-react';
import { useAuth, loginPath } from '../../lib/auth';
import { clearCart, setQuantity } from '../../lib/cart';
import { useTodayIntake } from '../../lib/health';
import { navigate } from '../../lib/router';
import { formatNumber } from '../../utils/format';
import { cartNutrition, computeTotals, formatCurrency } from '../../utils/pricing';
import { ConfirmDialog, EmptyState, ErrorState, hideBrokenImage, PageHeader, PageLoading, card, primaryButton, secondaryButton } from '../ui';
import { orderingMode, storeState, STORE_STATE_LABEL } from './storeStatus';
import { useCartStore } from './useCartStore';

export const CartPage: React.FC = () => {
  const { session } = useAuth();
  const { cart, merchant, unavailable, loading, error, priceChanged, reload } = useCartStore();
  const intake = useTodayIntake();
  const [confirmClear, setConfirmClear] = useState(false);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="購物車" />
        <EmptyState icon={<ShoppingBag className="h-12 w-12" />} title="購物車是空的" text="去看看附近店家的健康餐點吧！" action={<a href="#/stores" className={primaryButton}>開始點餐</a>} />
      </div>
    );
  }
  if (loading && !merchant) return <PageLoading />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;

  const totals = computeTotals(merchant || { deliveryFee: 0, serviceFee: 0, discount: 0 }, cart.items, 'pickup');
  const nutrition = cartNutrition(cart.items);
  const state = merchant ? storeState(merchant) : 'closed';
  const mode = merchant ? orderingMode(merchant) : 'unavailable';
  const blocked = !merchant || unavailable.size > 0 || mode === 'unavailable';
  const remaining = intake.targets ? intake.targets.dailyCalories - intake.consumedCalories : null;

  const goCheckout = () => navigate(session ? '/checkout' : loginPath('/checkout'));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="購物車" subtitle={<a href={merchant ? `#/store/${merchant.id}` : '#/stores'} className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline"><Store className="h-4 w-4" />{cart.merchantName}</a>} actions={<button onClick={() => setConfirmClear(true)} className={secondaryButton}><Trash2 className="h-4 w-4" />清空</button>} />

      {priceChanged && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">店家剛更新了價格，購物車已改用最新價格。</p>}
      {!merchant && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">這間店家已經下架，請清空購物車後重新點餐。</p>}
      {merchant && mode === 'unavailable' && <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">店家目前{STORE_STATE_LABEL[state]}，暫時無法下單。</p>}
      {merchant && mode === 'preorder' && <p className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800">店家現在休息中，結帳時可以預約營業時間取餐。</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          {cart.items.map((item) => {
            const bad = unavailable.has(item.key);
            return (
              <article key={item.key} className={`${card} flex gap-4 p-4 ${bad ? 'border-red-200 bg-red-50/40' : ''}`}>
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" onError={hideBrokenImage} /> : <div className="flex h-full items-center justify-center text-slate-300"><UtensilsCrossed className="h-7 w-7" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <h3 className="font-bold text-slate-900">{item.name}</h3>
                    <p className="shrink-0 font-black text-slate-900">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                  {item.options.length > 0 && <p className="mt-0.5 text-xs text-slate-500">{item.options.map((option) => option.name).join('、')}</p>}
                  {item.remark && <p className="mt-0.5 text-xs text-slate-500">備註：{item.remark}</p>}
                  {item.unitNutrition && <p className="mt-0.5 text-xs text-slate-400">每份 {formatNumber(item.unitNutrition.calories, 'kcal')}</p>}
                  {bad && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle className="h-3.5 w-3.5" />已售完或選項已變更，請移除後重新加入</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">單價 {formatCurrency(item.unitPrice)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQuantity(item.key, item.quantity - 1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label={`減少 ${item.name}`}><Minus className="h-4 w-4" /></button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => setQuantity(item.key, item.quantity + 1)} disabled={bad} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label={`增加 ${item.name}`}><Plus className="h-4 w-4" /></button>
                      <button onClick={() => setQuantity(item.key, 0)} className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`移除 ${item.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="space-y-4">
          <section className={`${card} p-5`}>
            <h2 className="font-black text-slate-900">營養總計</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-500">熱量</p><p className="font-black text-amber-600">{formatNumber(nutrition.total.calories, 'kcal')}</p></div>
              <div><p className="text-xs text-slate-500">蛋白質</p><p className="font-black text-blue-600">{formatNumber(nutrition.total.protein, 'g')}</p></div>
            </div>
            {!nutrition.complete && <p className="mt-2 text-xs text-slate-400">部分餐點店家未提供營養資訊，未計入。</p>}
            {remaining !== null && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${nutrition.total.calories > remaining ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-800'}`}>
                今天還可以吃 {Math.max(0, remaining)} kcal{nutrition.total.calories > remaining ? '，這張訂單會超過今日目標' : ''}
              </p>
            )}
          </section>
          <section className={`${card} p-5`}>
            <div className="flex justify-between text-sm text-slate-600"><span>餐點小計（{totals.itemCount} 件）</span><span>{formatCurrency(totals.subtotal)}</span></div>
            {merchant && merchant.minOrderAmount > totals.subtotal && (
              <p className="mt-2 text-xs font-bold text-amber-700">還差 {formatCurrency(merchant.minOrderAmount - totals.subtotal)} 才達最低消費</p>
            )}
            <p className="mt-2 text-xs text-slate-400">運費、服務費與折扣會在結帳時計算。</p>
            <button onClick={goCheckout} disabled={blocked || Boolean(merchant && merchant.minOrderAmount > totals.subtotal)} className={`${primaryButton} mt-4 w-full py-3`}>
              {session ? '前往結帳' : '登入後結帳'}
            </button>
          </section>
        </aside>
      </div>

      {confirmClear && (
        <ConfirmDialog title="清空購物車？" message="購物車裡的餐點會全部移除。" confirmLabel="清空" danger onCancel={() => setConfirmClear(false)} onConfirm={() => { clearCart(); setConfirmClear(false); }} />
      )}
    </div>
  );
};
