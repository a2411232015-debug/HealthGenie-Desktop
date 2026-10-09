import { useSyncExternalStore } from 'react';
import { Cart, CartItem, Merchant, Product } from '../types';
import { cartItemKey, computeLine } from '../utils/pricing';

// 購物車存在這台裝置的瀏覽器裡。金額只是預估，下單時以伺服器計算為準。

const STORAGE_KEY = 'healthgenie_cart_v2';
const EMPTY: Cart = { merchantId: null, merchantName: '', items: [] };
const listeners = new Set<() => void>();
let cache: Cart | null = null;

const isCartItem = (value: unknown): value is CartItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as CartItem;
  return typeof item.key === 'string'
    && typeof item.productId === 'string'
    && Number.isInteger(item.quantity) && item.quantity > 0
    && Number.isFinite(item.unitPrice)
    && Array.isArray(item.options);
};

const read = (): Cart => {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const items = Array.isArray(parsed?.items) ? parsed.items.filter(isCartItem) : [];
    cache = items.length > 0 && typeof parsed.merchantId === 'string'
      ? { merchantId: parsed.merchantId, merchantName: String(parsed.merchantName || ''), items }
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
};

const write = (cart: Cart): void => {
  cache = cart.items.length === 0 ? EMPTY : cart;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 無痕模式可能無法儲存，購物車仍會在這個分頁中運作
  }
  listeners.forEach((listener) => listener());
};

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    cache = null;
    listeners.forEach((listener) => listener());
  }
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getCart = read;
export const useCart = (): Cart => useSyncExternalStore(subscribe, read, read);

export const cartCount = (cart: Cart): number => cart.items.reduce((sum, item) => sum + item.quantity, 0);

export const buildCartItem = (product: Product, optionIds: string[], quantity: number, remark: string): CartItem => {
  const line = computeLine(product, optionIds);
  return {
    key: cartItemKey(product.id, optionIds, remark),
    productId: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    quantity,
    basePrice: product.price,
    options: line.options,
    remark: remark.trim(),
    unitPrice: line.unitPrice,
    unitNutrition: line.unitNutrition,
  };
};

/** 加入購物車；如果購物車裡是別家店的餐點，回傳 false（需先詢問使用者是否清空） */
export const addToCart = (merchant: Pick<Merchant, 'id' | 'name'>, item: CartItem, replaceOtherStore = false): boolean => {
  const cart = read();
  if (cart.items.length > 0 && cart.merchantId !== merchant.id && !replaceOtherStore) return false;
  const base = cart.merchantId === merchant.id ? cart.items : [];
  const existing = base.find((candidate) => candidate.key === item.key);
  const items = existing
    ? base.map((candidate) => candidate.key === item.key
      ? { ...candidate, quantity: Math.min(50, candidate.quantity + item.quantity) }
      : candidate)
    : [...base, item];
  write({ merchantId: merchant.id, merchantName: merchant.name, items });
  return true;
};

export const setQuantity = (key: string, quantity: number): void => {
  const cart = read();
  const items = quantity <= 0
    ? cart.items.filter((item) => item.key !== key)
    : cart.items.map((item) => (item.key === key ? { ...item, quantity: Math.min(50, quantity) } : item));
  write({ ...cart, items });
};

export const removeFromCart = (key: string): void => setQuantity(key, 0);

export const clearCart = (): void => write(EMPTY);

/** 用最新的菜單重新計算購物車價格；回傳已無法購買的品項 key */
export const refreshCartPrices = (products: Product[]): { unavailable: Set<string>; changed: boolean } => {
  const cart = read();
  const unavailable = new Set<string>();
  let changed = false;
  const items = cart.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product || !product.available) {
      unavailable.add(item.key);
      return item;
    }
    const line = computeLine(product, item.options.map((option) => option.optionId));
    if (Object.keys(line.errors).length > 0) {
      unavailable.add(item.key);
      return item;
    }
    if (line.unitPrice !== item.unitPrice || product.name !== item.name) {
      changed = true;
      return { ...item, name: product.name, imageUrl: product.imageUrl, basePrice: product.price, unitPrice: line.unitPrice, options: line.options, unitNutrition: line.unitNutrition };
    }
    return item;
  });
  if (changed) write({ ...cart, items });
  return { unavailable, changed };
};
