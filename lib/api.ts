import {
  FoodEstimate,
  FoodLog,
  FoodLogInput,
  Fulfillment,
  HealthProfile,
  Merchant,
  MerchantInput,
  MerchantStatus,
  Order,
  OrderStatus,
  Product,
  ProductInput,
  Profile,
  WeightLog,
} from '../types';
import { blobToBase64 } from '../utils/image';
import { newId } from './id';
import { supabase } from './supabase';

// 所有和資料庫溝通的程式都集中在這個檔案。
// 資料庫欄位是 snake_case，前端統一轉成 camelCase。

type Row = Record<string, unknown>;

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const check = <T,>(result: { data: T; error: { message: string; code?: string } | null }): T => {
  if (result.error) throw new ApiError(result.error.message, result.error.code);
  return result.data;
};

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const numOrNull = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ? null : num(value);
const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));
const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

// ===== 轉換 =====

export const toProfile = (row: Row): Profile => ({
  id: str(row.id),
  displayName: str(row.display_name),
  phone: str(row.phone),
  defaultAddress: str(row.default_address),
  health: (row.health && typeof row.health === 'object' ? row.health : {}) as Partial<HealthProfile>,
  isAdmin: row.is_admin === true,
});

export const toMerchant = (row: Row): Merchant => ({
  id: str(row.id),
  ownerId: str(row.owner_id),
  name: str(row.name),
  description: str(row.description),
  phone: str(row.phone),
  address: str(row.address),
  lat: numOrNull(row.lat),
  lng: numOrNull(row.lng),
  coverImageUrl: str(row.cover_image_url),
  openingHours: arr(row.opening_hours),
  pickupEnabled: row.pickup_enabled !== false,
  deliveryEnabled: row.delivery_enabled === true,
  deliveryFee: num(row.delivery_fee),
  serviceFee: num(row.service_fee),
  discount: num(row.discount),
  minOrderAmount: num(row.min_order_amount),
  prepMinutes: num(row.prep_minutes, 20),
  acceptingOrders: row.accepting_orders !== false,
  status: str(row.status) as MerchantStatus,
  reviewNote: str(row.review_note),
  createdAt: str(row.created_at),
});

const fromMerchantInput = (input: Partial<MerchantInput>): Row => {
  const row: Row = {};
  const map: Record<string, string> = {
    name: 'name',
    description: 'description',
    phone: 'phone',
    address: 'address',
    lat: 'lat',
    lng: 'lng',
    coverImageUrl: 'cover_image_url',
    openingHours: 'opening_hours',
    pickupEnabled: 'pickup_enabled',
    deliveryEnabled: 'delivery_enabled',
    deliveryFee: 'delivery_fee',
    serviceFee: 'service_fee',
    discount: 'discount',
    minOrderAmount: 'min_order_amount',
    prepMinutes: 'prep_minutes',
    acceptingOrders: 'accepting_orders',
  };
  Object.entries(input).forEach(([key, value]) => {
    if (map[key] && value !== undefined) row[map[key]] = typeof value === 'string' ? value.trim() : value;
  });
  return row;
};

export const toProduct = (row: Row): Product => ({
  id: str(row.id),
  merchantId: str(row.merchant_id),
  name: str(row.name),
  description: str(row.description),
  category: str(row.category),
  price: num(row.price),
  imageUrl: str(row.image_url),
  nutrition: (row.nutrition && typeof row.nutrition === 'object' ? row.nutrition : {}) as Product['nutrition'],
  allergens: arr<string>(row.allergens),
  optionGroups: arr(row.option_groups),
  available: row.available !== false,
  sortOrder: num(row.sort_order),
});

const fromProductInput = (input: ProductInput): Row => ({
  name: input.name.trim(),
  description: input.description.trim(),
  category: input.category.trim(),
  price: Math.round(input.price),
  image_url: input.imageUrl.trim(),
  nutrition: Object.fromEntries(
    Object.entries(input.nutrition).filter(([, value]) => value !== undefined && value !== null && Number.isFinite(Number(value))),
  ),
  allergens: input.allergens,
  option_groups: input.optionGroups,
  available: input.available,
  sort_order: input.sortOrder,
});

export const toOrder = (row: Row): Order => ({
  id: str(row.id),
  orderNumber: str(row.order_number),
  customerId: str(row.customer_id),
  merchantId: str(row.merchant_id),
  status: str(row.status) as OrderStatus,
  fulfillment: str(row.fulfillment) as Fulfillment,
  items: arr(row.items),
  itemCount: num(row.item_count),
  subtotal: num(row.subtotal),
  deliveryFee: num(row.delivery_fee),
  serviceFee: num(row.service_fee),
  discount: num(row.discount),
  total: num(row.total),
  merchantName: str(row.merchant_name),
  merchantPhone: str(row.merchant_phone),
  merchantAddress: str(row.merchant_address),
  contactName: str(row.contact_name),
  contactPhone: str(row.contact_phone),
  deliveryAddress: str(row.delivery_address),
  note: str(row.note),
  paymentMethod: 'cash',
  paymentStatus: (str(row.payment_status) || 'unpaid') as Order['paymentStatus'],
  estimatedReadyAt: row.estimated_ready_at ? str(row.estimated_ready_at) : null,
  scheduledFor: row.scheduled_for ? str(row.scheduled_for) : null,
  statusHistory: arr(row.status_history),
  cancelReason: str(row.cancel_reason),
  createdAt: str(row.created_at),
  completedAt: row.completed_at ? str(row.completed_at) : null,
});

const toFoodLog = (row: Row): FoodLog => ({
  id: str(row.id),
  eatenAt: str(row.eaten_at),
  name: str(row.name),
  calories: num(row.calories),
  protein: numOrNull(row.protein),
  fat: numOrNull(row.fat),
  carbs: numOrNull(row.carbs),
  source: (str(row.source) || 'manual') as FoodLog['source'],
  orderId: row.order_id ? str(row.order_id) : null,
});

// ===== 個人資料 =====

export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const data = check(await supabase().from('profiles').select('*').eq('id', userId).maybeSingle());
  return data ? toProfile(data) : null;
};

export const updateProfile = async (
  userId: string,
  patch: Partial<Pick<Profile, 'displayName' | 'phone' | 'defaultAddress' | 'health'>>,
): Promise<Profile> => {
  const row: Row = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.phone !== undefined) row.phone = patch.phone.trim();
  if (patch.defaultAddress !== undefined) row.default_address = patch.defaultAddress.trim();
  if (patch.health !== undefined) row.health = patch.health;
  const data = check(await supabase().from('profiles').update(row).eq('id', userId).select('*').single());
  return toProfile(data);
};

// ===== 店家 =====

export const fetchOpenMerchants = async (): Promise<Merchant[]> => {
  const data = check(await supabase().from('merchants').select('*').eq('status', 'approved').order('created_at'));
  return (data || []).map(toMerchant);
};

export const fetchMerchant = async (merchantId: string): Promise<Merchant | null> => {
  const data = check(await supabase().from('merchants').select('*').eq('id', merchantId).maybeSingle());
  return data ? toMerchant(data) : null;
};

export const fetchMyMerchant = async (userId: string): Promise<Merchant | null> => {
  const data = check(await supabase().from('merchants').select('*').eq('owner_id', userId).maybeSingle());
  return data ? toMerchant(data) : null;
};

export const applyAsMerchant = async (userId: string, input: MerchantInput): Promise<Merchant> => {
  const data = check(await supabase().from('merchants').insert({ ...fromMerchantInput(input), owner_id: userId }).select('*').single());
  return toMerchant(data);
};

export const updateMerchant = async (merchantId: string, patch: Partial<MerchantInput>): Promise<Merchant> => {
  const data = check(await supabase().from('merchants').update(fromMerchantInput(patch)).eq('id', merchantId).select('*').single());
  return toMerchant(data);
};

// ===== 餐點 =====

export const fetchProducts = async (merchantIds: string[]): Promise<Product[]> => {
  if (merchantIds.length === 0) return [];
  const data = check(await supabase().from('products').select('*').in('merchant_id', merchantIds)
    .order('sort_order').order('created_at'));
  return (data || []).map(toProduct);
};

export const createProduct = async (merchantId: string, input: ProductInput): Promise<Product> => {
  const data = check(await supabase().from('products').insert({ ...fromProductInput(input), merchant_id: merchantId }).select('*').single());
  return toProduct(data);
};

export const updateProduct = async (productId: string, input: ProductInput): Promise<Product> => {
  const data = check(await supabase().from('products').update(fromProductInput(input)).eq('id', productId).select('*').single());
  return toProduct(data);
};

export const setProductAvailable = async (productId: string, available: boolean): Promise<void> => {
  check(await supabase().from('products').update({ available }).eq('id', productId));
};

export const deleteProduct = async (productId: string): Promise<void> => {
  check(await supabase().from('products').delete().eq('id', productId));
};

export const uploadProductImage = async (userId: string, image: Blob): Promise<string> => {
  const path = `${userId}/${newId()}.jpg`;
  const storage = supabase().storage.from('product-images');
  const { error } = await storage.upload(path, image, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw new ApiError(`圖片上傳失敗：${error.message}`);
  return storage.getPublicUrl(path).data.publicUrl;
};

// ===== 訂單 =====

export interface PlaceOrderInput {
  merchantId: string;
  items: { productId: string; quantity: number; optionIds: string[]; remark: string }[];
  fulfillment: Fulfillment;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  note: string;
  clientRequestId: string;
  expectedTotal: number;
  /** ISO 時間；null 代表盡快 */
  scheduledFor: string | null;
}

export const placeOrder = async (input: PlaceOrderInput): Promise<Order> => {
  const data = check(await supabase().rpc('place_order', {
    p_merchant_id: input.merchantId,
    p_items: input.items,
    p_fulfillment: input.fulfillment,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_delivery_address: input.deliveryAddress,
    p_note: input.note,
    p_client_request_id: input.clientRequestId,
    p_expected_total: input.expectedTotal,
    p_scheduled_for: input.scheduledFor,
  }));
  return toOrder(data as Row);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus, reason = ''): Promise<Order> => {
  const data = check(await supabase().rpc('update_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason,
  }));
  return toOrder(data as Row);
};

export const fetchMyOrders = async (userId: string): Promise<Order[]> => {
  const data = check(await supabase().from('orders').select('*').eq('customer_id', userId)
    .order('created_at', { ascending: false }).limit(100));
  return (data || []).map(toOrder);
};

export const fetchOrder = async (orderId: string): Promise<Order | null> => {
  const data = check(await supabase().from('orders').select('*').eq('id', orderId).maybeSingle());
  return data ? toOrder(data) : null;
};

export const fetchMerchantOrders = async (merchantId: string, sinceIso: string): Promise<Order[]> => {
  const data = check(await supabase().from('orders').select('*').eq('merchant_id', merchantId)
    .gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(1000));
  return (data || []).map(toOrder);
};

export const fetchActiveMerchantOrders = async (merchantId: string): Promise<Order[]> => {
  const data = check(await supabase().from('orders').select('*').eq('merchant_id', merchantId)
    .in('status', ['pending', 'preparing', 'ready', 'delivering']).order('created_at', { ascending: true }).limit(200));
  return (data || []).map(toOrder);
};

/** 訂單有變動時呼叫 onChange；回傳取消訂閱的函式 */
export const subscribeToOrders = (filter: { merchantId?: string; customerId?: string }, onChange: () => void): (() => void) => {
  const client = supabase();
  const column = filter.merchantId ? 'merchant_id' : 'customer_id';
  const value = filter.merchantId || filter.customerId;
  if (!value) return () => undefined;
  const channel = client
    .channel(`orders-${column}-${value}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `${column}=eq.${value}` }, () => onChange())
    .subscribe();
  return () => { void client.removeChannel(channel); };
};

// ===== 健康紀錄 =====

export const fetchFoodLogs = async (sinceIso: string): Promise<FoodLog[]> => {
  const data = check(await supabase().from('food_logs').select('*').gte('eaten_at', sinceIso)
    .order('eaten_at', { ascending: false }).limit(200));
  return (data || []).map(toFoodLog);
};

export const addFoodLog = async (input: Omit<FoodLogInput, 'eatenAt'> & { eatenAt?: string }): Promise<FoodLog> => {
  const data = check(await supabase().from('food_logs').insert({
    name: input.name.trim(),
    calories: Math.round(input.calories),
    protein: input.protein,
    fat: input.fat,
    carbs: input.carbs,
    source: input.source,
    order_id: input.orderId,
    ...(input.eatenAt ? { eaten_at: input.eatenAt } : {}),
  }).select('*').single());
  return toFoodLog(data);
};

export const deleteFoodLog = async (id: string): Promise<void> => {
  check(await supabase().from('food_logs').delete().eq('id', id));
};

export const fetchLoggedOrderIds = async (orderIds: string[]): Promise<Set<string>> => {
  if (orderIds.length === 0) return new Set();
  const data = check(await supabase().from('food_logs').select('order_id').in('order_id', orderIds));
  return new Set((data || []).map((row) => str(row.order_id)));
};

export const fetchWeightLogs = async (): Promise<WeightLog[]> => {
  const data = check(await supabase().from('weight_logs').select('log_date, weight').order('log_date', { ascending: true }).limit(400));
  return (data || []).map((row) => ({ date: str(row.log_date), weight: num(row.weight) }));
};

export const saveWeight = async (userId: string, weight: number, date: string): Promise<void> => {
  check(await supabase().from('weight_logs').upsert({ user_id: userId, log_date: date, weight }, { onConflict: 'user_id,log_date' }));
};

// ===== 平台管理 =====

export const fetchAllMerchants = async (): Promise<Merchant[]> => {
  const data = check(await supabase().from('merchants').select('*').order('created_at', { ascending: false }));
  return (data || []).map(toMerchant);
};

export const setMerchantStatus = async (merchantId: string, status: MerchantStatus, reviewNote: string): Promise<Merchant> => {
  const data = check(await supabase().from('merchants').update({ status, review_note: reviewNote.trim() }).eq('id', merchantId).select('*').single());
  return toMerchant(data);
};

export const fetchTodayOrderCount = async (sinceIso: string): Promise<number> => {
  const result = await supabase().from('orders').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso);
  if (result.error) throw new ApiError(result.error.message);
  return result.count || 0;
};

// ===== 刪除帳號（透過 Supabase Edge Function）=====

export const deleteMyAccount = async (): Promise<void> => {
  const { data, error } = await supabase().functions.invoke('account', { body: { action: 'delete_account' } });
  if (error) {
    let message = '刪除帳號失敗，請稍後再試';
    try {
      const context = (error as { context?: Response }).context;
      const payload = context ? await context.json() : null;
      if (payload?.error) message = String(payload.error);
    } catch {
      // 保留預設訊息
    }
    throw new ApiError(message);
  }
  if (!data || (data as { ok?: boolean }).ok !== true) throw new ApiError('刪除帳號失敗，請稍後再試');
};

// ===== AI（透過 Supabase Edge Function，金鑰不會出現在網頁裡）=====

const invokeAi = async (body: Record<string, unknown>): Promise<FoodEstimate> => {
  const { data, error } = await supabase().functions.invoke('ai', { body });
  if (error) {
    let message = 'AI 服務暫時無法使用';
    try {
      const context = (error as { context?: Response }).context;
      const payload = context ? await context.json() : null;
      if (payload?.error) message = String(payload.error);
    } catch {
      // 保留預設訊息
    }
    throw new ApiError(message);
  }
  if (!data || typeof data !== 'object' || (data as { error?: string }).error) {
    throw new ApiError(String((data as { error?: string })?.error || 'AI 回傳資料格式錯誤'));
  }
  return data as FoodEstimate;
};

export const analyzeFoodPhoto = async (image: Blob): Promise<FoodEstimate> =>
  invokeAi({ action: 'analyze_food_photo', image: await blobToBase64(image), mimeType: 'image/jpeg' });

export const estimateDishNutrition = async (name: string, description: string, image?: Blob): Promise<FoodEstimate> =>
  invokeAi({
    action: 'estimate_dish',
    name,
    description,
    ...(image ? { image: await blobToBase64(image), mimeType: 'image/jpeg' } : {}),
  });
