import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Minus, Plus, Store, Trash2 } from 'lucide-react';
import { Cart, CartItem, Nutrition } from '../types';
import { getCart, getMerchant, getProducts, saveCart } from '../data/repository';
import { addNutrition, multiplyNutrition } from '../utils/numbers';
import { calculateCartItem, calculateItemSubtotal, formatCurrency } from '../utils/pricing';
import { generateHealthWarnings } from '../utils/health';
import { showToast } from '../utils/notifications';
import { trackEvent } from '../utils/merchantAnalytics';

export interface CheckoutData {
  merchantId: string;
  merchantName: string;
  itemsCount: number;
  subtotal: number;
  items: CartItem[];
}

interface ShoppingCartProps {
  onCheckout?: (data: CheckoutData) => void;
}

const persistCart = (cart: Cart, setCart: React.Dispatch<React.SetStateAction<Cart>>): void => {
  const normalized = {
    ...cart,
    items: cart.items.map(calculateCartItem),
  };
  if (saveCart(normalized)) setCart(normalized);
  else showToast('購物車儲存失敗，請稍後再試', 'error');
};

export default function ShoppingCart({ onCheckout }: ShoppingCartProps) {
  const initialCart = useMemo(() => getCart(), []);
  const [cart, setCart] = useState<Cart>(initialCart);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialCart.items.map((item) => item.id)),
  );
  const [catalogRevision, setCatalogRevision] = useState(0);

  useEffect(() => {
    const reloadCart = () => {
      const next = getCart();
      setCart(next);
      setSelectedIds((current) => {
        const valid = new Set(next.items.map((item) => item.id));
        const kept = new Set([...current].filter((id) => valid.has(id)));
        return kept.size > 0 || next.items.length === 0 ? kept : valid;
      });
    };
    const reloadCatalog = () => setCatalogRevision((value) => value + 1);
    window.addEventListener('cart_updated', reloadCart);
    window.addEventListener('products_updated', reloadCatalog);
    window.addEventListener('merchants_updated', reloadCatalog);
    return () => {
      window.removeEventListener('cart_updated', reloadCart);
      window.removeEventListener('products_updated', reloadCatalog);
      window.removeEventListener('merchants_updated', reloadCatalog);
    };
  }, []);

  const catalog = useMemo(() => getProducts(), [catalogRevision]);
  const merchant = useMemo(
    () => cart.merchantId ? getMerchant(cart.merchantId) : undefined,
    [cart.merchantId, catalogRevision],
  );

  const unavailableIds = useMemo(() => new Set(
    cart.items
      .filter((item) => catalog.find((product) => product.id === item.productId)?.available !== true)
      .map((item) => item.id),
  ), [cart.items, catalog]);

  const allIds = useMemo(() => cart.items.map((item) => item.id), [cart.items]);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const selectedItems = useMemo(
    () => cart.items.filter((item) => selectedIds.has(item.id)).map(calculateCartItem),
    [cart.items, selectedIds],
  );

  const totals = useMemo(() => selectedItems.reduce(
    (summary, item) => ({
      price: summary.price + calculateItemSubtotal(item),
      count: summary.count + item.quantity,
      nutrition: addNutrition(summary.nutrition, multiplyNutrition(item.unitNutrition, item.quantity)),
    }),
    {
      price: 0,
      count: 0,
      nutrition: {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fiber: 0,
        sodium: 0,
        sugar: 0,
      } as Nutrition,
    },
  ), [selectedItems]);

  const feedbackMessages = useMemo(() => {
    if (selectedItems.length === 0) return [];
    const messages = generateHealthWarnings(
      { calories: totals.nutrition.calories, macros: totals.nutrition },
      { tdee: 2000 },
      1200,
    );
    messages.unshift({
      type: 'base',
      text: `這餐共 ${Math.round(totals.nutrition.calories)} 大卡，蛋白質 ${Math.round(totals.nutrition.protein)}g。`,
      color: 'text-slate-700 font-bold',
    });
    return messages;
  }, [selectedItems.length, totals.nutrition]);

  const updateQuantity = (itemId: string, delta: number) => {
    const next = {
      ...cart,
      items: cart.items.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    };
    persistCart(next, setCart);
  };

  const deleteItem = (itemId: string) => {
    if (!window.confirm('確定要移除此餐點嗎？')) return;
    const items = cart.items.filter((item) => item.id !== itemId);
    persistCart({
      merchantId: items[0]?.merchantId || null,
      merchantName: items[0]?.merchantName || '',
      items,
    }, setCart);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    showToast('餐點已移除');
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0 || !window.confirm('確定要刪除勾選的餐點嗎？')) return;
    const items = cart.items.filter((item) => !selectedIds.has(item.id));
    persistCart({
      merchantId: items[0]?.merchantId || null,
      merchantName: items[0]?.merchantName || '',
      items,
    }, setCart);
    setSelectedIds(new Set());
    showToast('已刪除勾選餐點');
  };

  const hasSelectedUnavailable = selectedItems.some((item) => unavailableIds.has(item.id));
  const merchantPaused = merchant?.acceptingOrders === false;
  const checkoutDisabled = selectedItems.length === 0 || hasSelectedUnavailable || merchantPaused;

  const handleCheckout = () => {
    if (checkoutDisabled || !cart.merchantId) {
      showToast(
        merchantPaused ? '店家目前暫停接單' : hasSelectedUnavailable ? '請先移除已售完餐點' : '請先勾選餐點',
        'error',
      );
      return;
    }
    trackEvent('checkout', {
      amount: totals.price,
      storeName: cart.merchantName,
      metadata: { itemsCount: totals.count },
    });
    onCheckout?.({
      merchantId: cart.merchantId,
      merchantName: cart.merchantName,
      itemsCount: totals.count,
      subtotal: totals.price,
      items: selectedItems,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 text-slate-900">
      <header className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-teal-600 uppercase tracking-wider">目前商家</p>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 mt-1">
            <Store className="w-5 h-5" />
            {cart.merchantName || '購物車'}
          </h1>
        </div>
        {merchantPaused && (
          <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-sm font-bold">
            店家暫停接單
          </span>
        )}
      </header>

      {cart.items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center shadow-sm">
          <div className="text-4xl mb-3">🛒</div>
          <h2 className="font-bold text-slate-700">尚未選擇餐點</h2>
          <p className="text-slate-400 text-sm mt-1">購物車營養統計為 0 kcal</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cart.items.map((rawItem) => {
            const item = calculateCartItem(rawItem);
            const unavailable = unavailableIds.has(item.id);
            return (
              <article
                key={item.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${unavailable ? 'border-red-200' : 'border-slate-100'}`}
              >
                {unavailable && (
                  <div className="bg-red-50 text-red-700 px-5 py-2 text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    此餐點已售完，請移除後再結帳
                  </div>
                )}
                <div className="p-5 flex flex-col md:flex-row gap-5">
                  <div className="flex gap-4 flex-1">
                    <input
                      aria-label={`選取 ${item.name}`}
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })}
                      className="mt-7 w-4 h-4 accent-teal-500"
                    />
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={`w-20 h-20 object-cover rounded-xl border border-slate-100 ${unavailable ? 'grayscale opacity-50' : ''}`}
                    />
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-800">{item.name}</h3>
                      <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <p>基本餐盒：{formatCurrency(item.priceBreakdown.basePrice)}</p>
                        {item.selectedOptions.map((option) => (
                          <p key={`${option.groupId}_${option.optionId}`}>
                            {option.groupName}：{option.name}
                            <span className="ml-2 text-teal-600">
                              {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : '+NT$0'}
                            </span>
                          </p>
                        ))}
                        {item.userRemark && <p>備註：{item.userRemark}</p>}
                        <p className="font-bold text-slate-700 pt-1">單價：{formatCurrency(item.priceBreakdown.unitPrice)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-3">
                    <p className="font-black text-teal-600 text-lg">{formatCurrency(calculateItemSubtotal(item))}</p>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        aria-label="減少數量"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-2.5 hover:bg-slate-50 text-slate-500"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-bold">{item.quantity}</span>
                      <button
                        aria-label="增加數量"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-2.5 hover:bg-slate-50 text-slate-500"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="sticky bottom-0 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 z-10">
        <div className="flex flex-wrap gap-2">
          {feedbackMessages.length > 0 ? feedbackMessages.map((message, index) => (
            <span key={index} className={`text-sm bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg ${message.color}`}>
              {message.text}
            </span>
          )) : (
            <span className="text-sm text-slate-500">尚未選擇餐點 · 0 kcal</span>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => setSelectedIds(isAllSelected ? new Set() : new Set(allIds))}
                className="w-4 h-4 accent-teal-500"
              />
              全選 ({allIds.length})
            </label>
            <button
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              className="text-slate-500 hover:text-red-500 disabled:opacity-40 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> 刪除
            </button>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-5">
            <div className="text-right">
              <p className="text-xs text-slate-500">{totals.count} 個餐點</p>
              <p className="text-2xl font-black text-teal-600">{formatCurrency(totals.price)}</p>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkoutDisabled}
              className="px-8 py-3.5 rounded-xl bg-teal-500 text-white font-black hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              去買單
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
