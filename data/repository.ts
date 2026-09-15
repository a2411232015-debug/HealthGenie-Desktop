import { MOCK_MEALS, MOCK_MERCHANTS, MOCK_ORDERS, MOCK_STATS, createDefaultOptionGroups } from '../constants';
import {
  ActivityLevel,
  Cart,
  CartItem,
  DailyStats,
  Gender,
  MealRecommendation,
  Merchant,
  Order,
  OrderItem,
  OrderStatus,
  SelectedOptionSnapshot,
  UserProfile,
  WeightData,
} from '../types';
import { normalizeNutrition, toSafeNumber } from '../utils/numbers';
import {
  calculateCartItem,
  calculateItemSubtotal,
  calculatePriceBreakdown,
  calculateUnitNutrition,
  createSelectedOptionSnapshot,
  productNutrition,
} from '../utils/pricing';

const VERSION = 1;

export const STORAGE_KEYS = {
  user: 'healthgenie_user',
  cart: 'healthgenie_cart',
  merchants: 'healthgenie_merchants',
  products: 'healthgenie_products',
  orders: 'healthgenie_orders',
} as const;

interface Envelope<T> {
  version: number;
  data: T;
}

export interface UserData {
  profile: UserProfile;
  dailyStats: DailyStats;
  weightHistory: WeightData[];
  dietaryPreferences: string[];
}

const DEFAULT_PROFILE: UserProfile = {
  gender: Gender.MALE,
  age: 28,
  height: 175,
  weight: 70,
  targetWeight: 65,
  activityLevel: ActivityLevel.MODERATE,
  phone: '0912-345-678',
  address: '台北市大安區安和路一段165號',
  dietaryPreferences: [],
};

const createInitialWeightHistory = (): WeightData[] =>
  Array.from({ length: 90 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (89 - index));
    const weight = index === 89 ? 70 : Number((78 - index * 0.08).toFixed(1));
    return {
      date: index === 89 ? '今日' : `${date.getMonth() + 1}/${date.getDate()}`,
      weight,
    };
  });

const DEFAULT_USER: UserData = {
  profile: DEFAULT_PROFILE,
  dailyStats: MOCK_STATS,
  weightHistory: createInitialWeightHistory(),
  dietaryPreferences: [],
};

const EMPTY_CART: Cart = {
  merchantId: null,
  merchantName: '',
  items: [],
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

const readEnvelope = <T,>(key: string): T | undefined => {
  const parsed = readJson(key);
  if (!parsed || typeof parsed !== 'object') return undefined;
  const candidate = parsed as Partial<Envelope<T>>;
  if (candidate.version === VERSION && candidate.data !== undefined) return candidate.data;
  return undefined;
};

const writeEnvelope = <T,>(key: string, data: T): boolean => {
  try {
    const envelope: Envelope<T> = { version: VERSION, data };
    localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
};

const dispatchUpdate = (eventName: string): void => {
  window.dispatchEvent(new Event(eventName));
};

const optionalNumber = (value: unknown): number | undefined =>
  value === undefined || value === null || value === '' ? undefined : toSafeNumber(value);

const findMerchantId = (name: string): string =>
  MOCK_MERCHANTS.find((merchant) => merchant.name === name)?.id ||
  `merchant_${name.replace(/\s+/g, '_').toLowerCase()}`;

const normalizeProduct = (raw: Partial<MealRecommendation> & Record<string, unknown>): MealRecommendation => {
  const id = String(raw.id || `meal_${Date.now()}`);
  const merchant = String(raw.merchant || '我的健康餐盒');
  const rawMacros = raw.macros && typeof raw.macros === 'object'
    ? raw.macros as Record<string, unknown>
    : {};
  return {
    id,
    merchantId: String(raw.merchantId || findMerchantId(merchant)),
    name: String(raw.name || '未命名餐點'),
    merchant,
    distance: Math.max(0, toSafeNumber(raw.distance)),
    calories: optionalNumber(raw.calories),
    macros: {
      protein: optionalNumber(rawMacros.protein),
      fat: optionalNumber(rawMacros.fat),
      carbs: optionalNumber(rawMacros.carbs),
      fiber: optionalNumber(rawMacros.fiber),
      sodium: optionalNumber(rawMacros.sodium),
      sugar: optionalNumber(rawMacros.sugar),
    },
    imageUrl: String(raw.imageUrl || ''),
    price: Math.max(0, toSafeNumber(raw.price)),
    available: raw.available !== false,
    optionGroups: Array.isArray(raw.optionGroups) && raw.optionGroups.length > 0
      ? clone(raw.optionGroups)
      : createDefaultOptionGroups(id),
  };
};

export const getProducts = (): MealRecommendation[] => {
  const current = readEnvelope<MealRecommendation[]>(STORAGE_KEYS.products);
  if (Array.isArray(current)) return current.map((product) => normalizeProduct(product as MealRecommendation & Record<string, unknown>));

  const legacy = readJson('meals');
  const migrated = Array.isArray(legacy) && legacy.length > 0
    ? legacy.map((product) => normalizeProduct(product as Partial<MealRecommendation> & Record<string, unknown>))
    : clone(MOCK_MEALS);
  writeEnvelope(STORAGE_KEYS.products, migrated);
  return migrated;
};

export const saveProducts = (products: MealRecommendation[]): boolean => {
  const normalized = products.map((product) => normalizeProduct(product as MealRecommendation & Record<string, unknown>));
  const saved = writeEnvelope(STORAGE_KEYS.products, normalized);
  if (saved) dispatchUpdate('products_updated');
  return saved;
};

export const getMerchants = (): Merchant[] => {
  const current = readEnvelope<Merchant[]>(STORAGE_KEYS.merchants);
  if (Array.isArray(current)) return current;
  const merchants = clone(MOCK_MERCHANTS);
  writeEnvelope(STORAGE_KEYS.merchants, merchants);
  return merchants;
};

export const saveMerchants = (merchants: Merchant[]): boolean => {
  const safeMerchants = merchants.map((merchant) => ({
    ...merchant,
    lat: toSafeNumber(merchant.lat),
    lng: toSafeNumber(merchant.lng),
    deliveryFee: Math.max(0, toSafeNumber(merchant.deliveryFee)),
    serviceFee: Math.max(0, toSafeNumber(merchant.serviceFee)),
    discount: Math.max(0, toSafeNumber(merchant.discount)),
    acceptingOrders: merchant.acceptingOrders !== false,
  }));
  const saved = writeEnvelope(STORAGE_KEYS.merchants, safeMerchants);
  if (saved) dispatchUpdate('merchants_updated');
  return saved;
};

export const getMerchant = (merchantId: string): Merchant | undefined =>
  getMerchants().find((merchant) => merchant.id === merchantId);

export const saveMerchant = (merchant: Merchant): boolean => {
  const merchants = getMerchants();
  const index = merchants.findIndex((item) => item.id === merchant.id);
  if (index >= 0) merchants[index] = merchant;
  else merchants.push(merchant);
  return saveMerchants(merchants);
};

const snapshotsFromNames = (
  product: MealRecommendation | undefined,
  names: unknown,
): SelectedOptionSnapshot[] => {
  if (!product || !Array.isArray(names)) return [];
  const snapshots: SelectedOptionSnapshot[] = [];
  for (const nameValue of names) {
    const name = String(nameValue).replace(/^備註:\s*/, '');
    for (const group of product.optionGroups) {
      const option = group.options.find((candidate) => candidate.name === name);
      if (option) snapshots.push(createSelectedOptionSnapshot(group.id, group.name, option));
    }
  }
  return snapshots;
};

const normalizeCartItem = (raw: Record<string, unknown>, merchantId: string, merchantName: string): CartItem => {
  const products = getProducts();
  const product = products.find((candidate) =>
    candidate.id === raw.productId || candidate.name === raw.name || candidate.name === raw.itemName,
  );
  const legacyNames = raw.customizations || raw.customOptions;
  const selectedOptions = Array.isArray(raw.selectedOptions)
    ? raw.selectedOptions as SelectedOptionSnapshot[]
    : snapshotsFromNames(product, legacyNames);
  const baseNutrition = product
    ? productNutrition(product)
    : normalizeNutrition(raw.baseNutrition as Record<string, unknown> || raw.macros as Record<string, unknown>);
  const basePrice = product?.price ?? toSafeNumber(raw.basePrice ?? raw.price);
  const item: CartItem = {
    id: String(raw.id || `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    productId: String(raw.productId || product?.id || raw.id || ''),
    merchantId: String(raw.merchantId || product?.merchantId || merchantId),
    merchantName: String(raw.merchantName || product?.merchant || merchantName),
    name: String(raw.name || raw.itemName || product?.name || '未命名餐點'),
    imageUrl: String(raw.imageUrl || product?.imageUrl || ''),
    quantity: Math.max(1, Math.floor(toSafeNumber(raw.quantity) || 1)),
    basePrice,
    baseNutrition,
    selectedOptions,
    priceBreakdown: calculatePriceBreakdown(basePrice, selectedOptions),
    unitNutrition: calculateUnitNutrition(baseNutrition, selectedOptions),
    userRemark: String(raw.userRemark || '').slice(0, 100),
  };
  return calculateCartItem(item);
};

const migrateCart = (legacy: unknown): Cart => {
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    const candidate = legacy as Partial<Cart>;
    if (Array.isArray(candidate.items)) {
      const merchantId = candidate.merchantId || null;
      const merchantName = candidate.merchantName || '';
      const items = candidate.items.map((item) =>
        normalizeCartItem(item as unknown as Record<string, unknown>, merchantId || '', merchantName),
      );
      return {
        merchantId: items[0]?.merchantId || merchantId,
        merchantName: items[0]?.merchantName || merchantName,
        items: items.filter((item) => item.merchantId === (items[0]?.merchantId || merchantId)),
      };
    }
  }

  if (!Array.isArray(legacy) || legacy.length === 0) return clone(EMPTY_CART);
  const firstStore = legacy.find((store) => Array.isArray(store?.products) && store.products.length > 0);
  if (!firstStore) return clone(EMPTY_CART);
  const merchantName = String(firstStore.storeName || '');
  const merchantId = String(firstStore.merchantId || findMerchantId(merchantName));
  const items = firstStore.products.map((product: Record<string, unknown>) =>
    normalizeCartItem(product, merchantId, merchantName),
  );
  return { merchantId, merchantName, items };
};

export const getCart = (): Cart => {
  const current = readEnvelope<Cart>(STORAGE_KEYS.cart);
  if (current) return migrateCart(current);
  const cart = migrateCart(readJson('user_cart'));
  writeEnvelope(STORAGE_KEYS.cart, cart);
  return cart;
};

export const saveCart = (cart: Cart): boolean => {
  const merchantId = cart.items[0]?.merchantId || cart.merchantId || null;
  const safeCart: Cart = {
    merchantId,
    merchantName: cart.items[0]?.merchantName || cart.merchantName || '',
    items: cart.items
      .map(calculateCartItem)
      .filter((item) => item.merchantId === merchantId),
  };
  const saved = writeEnvelope(STORAGE_KEYS.cart, safeCart);
  if (saved) dispatchUpdate('cart_updated');
  return saved;
};

export const clearCart = (): boolean => saveCart(clone(EMPTY_CART));

const normalizeStatus = (status: unknown): OrderStatus => {
  if (status === 'waiting_pickup') return OrderStatus.WAITING_DELIVERY;
  return Object.values(OrderStatus).includes(status as OrderStatus)
    ? status as OrderStatus
    : OrderStatus.PENDING;
};

const normalizeOrderItem = (raw: Record<string, unknown>, merchantId: string, merchantName: string): OrderItem => {
  const cartItem = normalizeCartItem(raw, merchantId, merchantName);
  const subtotal = calculateItemSubtotal(cartItem);
  return {
    ...cartItem,
    itemName: String(raw.itemName || cartItem.name),
    customOptions: cartItem.selectedOptions.map((option) => `${option.groupName}：${option.name}`),
    price: cartItem.priceBreakdown.unitPrice,
    subtotal,
  };
};

const normalizeOrder = (raw: Record<string, unknown>): Order => {
  const storeName = String(raw.storeName || 'HealthGenie');
  const merchantId = String(raw.merchantId || findMerchantId(storeName));
  const createdAt = String(raw.createdAt || new Date().toISOString());
  const status = normalizeStatus(raw.status);
  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => normalizeOrderItem(item as Record<string, unknown>, merchantId, storeName))
    : [];
  const subtotal = raw.subtotal === undefined
    ? items.reduce((sum, item) => sum + item.subtotal, 0)
    : Math.max(0, toSafeNumber(raw.subtotal));
  const deliveryFee = Math.max(0, toSafeNumber(raw.deliveryFee));
  const serviceFee = Math.max(0, toSafeNumber(raw.serviceFee));
  const discount = Math.max(0, toSafeNumber(raw.discount));
  return {
    orderId: String(raw.orderId || `HG${Date.now()}`),
    clientRequestId: String(raw.clientRequestId || raw.orderId || `request_${Date.now()}`),
    merchantId,
    storeName,
    storePhone: String(raw.storePhone || getMerchant(merchantId)?.phone || ''),
    items,
    subtotal,
    totalAmount: Math.max(0, toSafeNumber(raw.totalAmount ?? subtotal + deliveryFee + serviceFee - discount)),
    deliveryFee,
    serviceFee,
    discount,
    address: String(raw.address || ''),
    estimatedArrival: String(raw.estimatedArrival || '約 30–40 分鐘'),
    createdAt,
    status,
    statusHistory: Array.isArray(raw.statusHistory) && raw.statusHistory.length > 0
      ? raw.statusHistory.map((entry: Record<string, unknown>) => ({
          status: normalizeStatus(entry.status),
          timestamp: String(entry.timestamp || createdAt),
        }))
      : [{ status, timestamp: createdAt }],
    paymentMethod: String(raw.paymentMethod || 'LINE Pay'),
    note: String(raw.note || '').slice(0, 100),
    cancelReason: raw.cancelReason ? String(raw.cancelReason) : undefined,
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
  };
};

export const getOrders = (): Order[] => {
  const current = readEnvelope<Order[]>(STORAGE_KEYS.orders);
  if (Array.isArray(current)) return current.map((order) => normalizeOrder(order as unknown as Record<string, unknown>));
  const legacy = readJson('user_orders');
  const orders = Array.isArray(legacy)
    ? legacy.map((order) => normalizeOrder(order as Record<string, unknown>))
    : clone(MOCK_ORDERS);
  writeEnvelope(STORAGE_KEYS.orders, orders);
  return orders;
};

export const saveOrders = (orders: Order[]): boolean => {
  const normalized = orders.map((order) => normalizeOrder(order as unknown as Record<string, unknown>));
  const saved = writeEnvelope(STORAGE_KEYS.orders, normalized);
  if (saved) dispatchUpdate('orders_updated');
  return saved;
};

export const createOrder = (order: Order): { order: Order; created: boolean } => {
  const orders = getOrders();
  const duplicate = orders.find((existing) => existing.clientRequestId === order.clientRequestId);
  if (duplicate) return { order: duplicate, created: false };
  const normalized = normalizeOrder(order as unknown as Record<string, unknown>);
  if (!saveOrders([normalized, ...orders])) throw new Error('訂單資料無法儲存');
  return { order: normalized, created: true };
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED, OrderStatus.REJECTED],
  [OrderStatus.PREPARING]: [OrderStatus.WAITING_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.WAITING_DELIVERY]: [OrderStatus.DELIVERING],
  [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

export const updateOrderStatus = (
  orderId: string,
  nextStatus: OrderStatus,
  reason?: string,
): { success: boolean; order?: Order; message?: string } => {
  const orders = getOrders();
  const index = orders.findIndex((order) => order.orderId === orderId);
  if (index < 0) return { success: false, message: '找不到訂單' };
  const current = orders[index];
  if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
    return { success: false, order: current, message: '不允許此訂單狀態轉換' };
  }
  const timestamp = new Date().toISOString();
  const updated: Order = {
    ...current,
    status: nextStatus,
    statusHistory: [...current.statusHistory, { status: nextStatus, timestamp }],
    ...(reason ? { cancelReason: reason } : {}),
    ...(nextStatus === OrderStatus.COMPLETED ? { completedAt: timestamp } : {}),
  };
  orders[index] = updated;
  if (!saveOrders(orders)) return { success: false, order: current, message: '狀態儲存失敗' };
  return { success: true, order: updated };
};

const normalizeUser = (raw: Partial<UserData>): UserData => ({
  profile: {
    ...DEFAULT_PROFILE,
    ...(raw.profile || {}),
    age: Math.max(1, toSafeNumber(raw.profile?.age ?? DEFAULT_PROFILE.age)),
    height: Math.max(1, toSafeNumber(raw.profile?.height ?? DEFAULT_PROFILE.height)),
    weight: Math.max(1, toSafeNumber(raw.profile?.weight ?? DEFAULT_PROFILE.weight)),
  },
  dailyStats: raw.dailyStats || clone(MOCK_STATS),
  weightHistory: Array.isArray(raw.weightHistory)
    ? raw.weightHistory.map((entry) => ({ date: String(entry.date), weight: toSafeNumber(entry.weight) }))
    : createInitialWeightHistory(),
  dietaryPreferences: Array.isArray(raw.dietaryPreferences) ? raw.dietaryPreferences.map(String) : [],
});

export const getUser = (): UserData => {
  const current = readEnvelope<UserData>(STORAGE_KEYS.user);
  if (current) return normalizeUser(current);
  const legacyProfile = readJson('userProfile') as UserProfile | undefined;
  const legacyStats = readJson('dailyStats') as DailyStats | undefined;
  const legacyWeights = readJson('weightHistory') as WeightData[] | undefined;
  const user = normalizeUser({
    profile: legacyProfile || DEFAULT_PROFILE,
    dailyStats: legacyStats || MOCK_STATS,
    weightHistory: legacyWeights,
    dietaryPreferences: legacyProfile?.dietaryPreferences || [],
  });
  writeEnvelope(STORAGE_KEYS.user, user);
  return user;
};

export const saveUser = (user: UserData): boolean => {
  const saved = writeEnvelope(STORAGE_KEYS.user, normalizeUser(user));
  if (saved) dispatchUpdate('user_updated');
  return saved;
};
