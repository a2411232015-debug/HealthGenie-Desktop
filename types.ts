// ===== 使用者 =====

export enum ActivityLevel {
  SEDENTARY = '久坐（辦公室工作）',
  LIGHT = '輕度（每週運動 1-3 天）',
  MODERATE = '中度（每週運動 3-5 天）',
  HEAVY = '重度（每週運動 6-7 天）',
}

export enum Gender {
  MALE = '男',
  FEMALE = '女',
}

export interface HealthProfile {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  targetWeight?: number;
  activityLevel: ActivityLevel;
}

export interface Profile {
  id: string;
  displayName: string;
  phone: string;
  defaultAddress: string;
  health: Partial<HealthProfile>;
  isAdmin: boolean;
}

// ===== 店家 =====

export interface OpeningSlot {
  /** 0 = 週日 … 6 = 週六 */
  day: number;
  /** HH:MM，24 小時制；close 小於等於 open 代表營業到隔天凌晨 */
  open: string;
  close: string;
}

export type MerchantStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Merchant {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  coverImageUrl: string;
  openingHours: OpeningSlot[];
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  minOrderAmount: number;
  prepMinutes: number;
  acceptingOrders: boolean;
  status: MerchantStatus;
  reviewNote: string;
  createdAt: string;
}

export type MerchantInput = Omit<Merchant, 'id' | 'ownerId' | 'status' | 'reviewNote' | 'createdAt'>;

// ===== 餐點 =====

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sodium: number;
  sugar: number;
}

export type NutritionKey = keyof Nutrition;

export interface ProductOption {
  id: string;
  name: string;
  priceDelta: number;
  caloriesDelta: number;
  proteinDelta: number;
  fatDelta: number;
  carbsDelta: number;
  fiberDelta: number;
  sodiumDelta: number;
  available: boolean;
}

export interface OptionGroup {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  /** 未提供的營養素不會出現在物件裡 */
  nutrition: Partial<Nutrition>;
  allergens: string[];
  optionGroups: OptionGroup[];
  available: boolean;
  sortOrder: number;
}

export type ProductInput = Omit<Product, 'id' | 'merchantId'>;

export const ALLERGENS = ['堅果', '花生', '蛋', '奶', '海鮮', '麩質', '大豆'] as const;

// ===== 購物車 =====

export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

export interface CartItem {
  /** 同一餐點、同樣選項、同樣備註會合併成同一個 key */
  key: string;
  productId: string;
  name: string;
  imageUrl: string;
  quantity: number;
  basePrice: number;
  options: SelectedOption[];
  remark: string;
  unitPrice: number;
  unitNutrition: Nutrition | null;
}

export interface Cart {
  merchantId: string | null;
  merchantName: string;
  items: CartItem[];
}

// ===== 訂單 =====

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type Fulfillment = 'pickup' | 'delivery';

export interface OrderItem {
  productId: string;
  name: string;
  imageUrl: string;
  quantity: number;
  basePrice: number;
  optionPrice: number;
  unitPrice: number;
  subtotal: number;
  options: SelectedOption[];
  remark: string;
  unitNutrition: Nutrition | null;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  merchantId: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  merchantName: string;
  merchantPhone: string;
  merchantAddress: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  note: string;
  paymentMethod: 'cash';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  estimatedReadyAt: string | null;
  statusHistory: StatusHistoryEntry[];
  cancelReason: string;
  createdAt: string;
  completedAt: string | null;
}

// ===== 健康紀錄 =====

export interface FoodLog {
  id: string;
  eatenAt: string;
  name: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  source: 'manual' | 'order' | 'photo';
  orderId: string | null;
}

export type FoodLogInput = Omit<FoodLog, 'id'>;

export interface WeightLog {
  date: string;
  weight: number;
}

export interface FoodEstimate {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sodium?: number;
  advice?: string;
}
