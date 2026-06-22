
export enum ActivityLevel {
  SEDENTARY = '久坐 (辦公室工作)',
  LIGHT = '輕度 (每週運動 1-3 天)',
  MODERATE = '中度 (每週運動 3-5 天)',
  HEAVY = '重度 (每週運動 6-7 天)',
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

export interface MealRecommendation {
  id: string;
  name: string;
  merchant: string;
  distance: number; // km
  calories: number;
  macros: {
    protein: number;
    fat: number;
    carbs: number;
    sugar: number;
    sodium: number;
    fiber: number;
  };
  imageUrl: string;
  price: number;
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
  WAITING_PICKUP = 'waiting_pickup',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface OrderItem {
  itemName: string;
  quantity: number;
  price: number;
  customOptions?: string[];
  imageUrl?: string;
}

export interface Order {
  orderId: string;
  storeName: string;
  storePhone: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  address: string;
  estimatedArrival: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: string;
  note: string;
  cancelReason?: string;
  completedAt?: string;
}

export enum TaskCategory {
  EXERCISE = '運動',
  NUTRITION = '飲食',
  HABITS = '習慣'
}

export interface TaskItem {
  id: string;
  title: string;
  category: TaskCategory;
  isCompleted: boolean;
  description?: string;
}

export type AnalyticsEventType = 'view_menu' | 'click_meal' | 'add_to_cart' | 'checkout' | 'order_created' | 'navigate_store';

export interface AnalyticsEvent {
  eventId: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  isMock: boolean;
  mealId?: string;
  mealName?: string;
  storeName?: string;
  amount?: number;
  metadata?: Record<string, any>;
}