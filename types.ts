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

export interface UserProfile {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  targetWeight?: number;
  activityLevel: ActivityLevel;
  phone?: string;
  address?: string;
  dietaryPreferences?: string[];
}

export interface DailyStats {
  calories: { current: number; target: number };
  steps: { current: number; target: number };
  water: { current: number; target: number };
}

export interface WeightData {
  date: string;
  weight: number;
}

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sodium: number;
  sugar: number;
}

export interface NutritionDelta {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sodium: number;
  sugar?: number;
}

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

export interface MealRecommendation {
  id: string;
  merchantId: string;
  name: string;
  merchant: string;
  distance: number;
  calories?: number;
  macros?: Partial<Omit<Nutrition, 'calories'>>;
  imageUrl: string;
  price: number;
  available: boolean;
  optionGroups: OptionGroup[];
}

export interface Merchant {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  hours: string;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  acceptingOrders: boolean;
}

export interface SelectedOptionSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
  nutritionDelta: NutritionDelta;
}

export interface PriceBreakdown {
  basePrice: number;
  optionPrice: number;
  unitPrice: number;
}

export interface CartItem {
  id: string;
  productId: string;
  merchantId: string;
  merchantName: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  basePrice: number;
  baseNutrition?: Nutrition;
  selectedOptions: SelectedOptionSnapshot[];
  priceBreakdown: PriceBreakdown;
  unitNutrition: Nutrition;
  userRemark?: string;
}

export interface Cart {
  merchantId: string | null;
  merchantName: string;
  items: CartItem[];
}

export interface AnalysisResult {
  foodName: string;
  calories: string;
  nutrients: string;
  advice: string;
}

export enum AppTab {
  DASHBOARD = 'dashboard',
  MEAL_PLAN = 'meal_plan',
  PROFILE = 'profile',
  ADMIN = 'admin',
  SHOPPING_CART = 'shopping_cart',
  CHECKOUT = 'checkout',
  ORDERS = 'orders',
  ORDER_DETAIL = 'order_detail',
}

export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  WAITING_DELIVERY = 'waiting_delivery',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
}

export interface OrderItem extends CartItem {
  itemName: string;
  customOptions?: string[];
  price: number;
  subtotal: number;
}

export interface Order {
  orderId: string;
  clientRequestId: string;
  merchantId: string;
  storeName: string;
  storePhone: string;
  items: OrderItem[];
  subtotal: number;
  totalAmount: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  address: string;
  estimatedArrival: string;
  createdAt: string;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  paymentMethod: string;
  note: string;
  cancelReason?: string;
  completedAt?: string;
}

export enum TaskCategory {
  EXERCISE = '運動',
  NUTRITION = '飲食',
  HABITS = '習慣',
}

export interface TaskItem {
  id: string;
  title: string;
  category: TaskCategory;
  isCompleted: boolean;
  description?: string;
}

export type AnalyticsEventType =
  | 'view_menu'
  | 'click_meal'
  | 'add_to_cart'
  | 'checkout'
  | 'order_created'
  | 'navigate_store';

export interface AnalyticsEvent {
  eventId: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  isMock: boolean;
  mealId?: string;
  mealName?: string;
  storeName?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}
