import React from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  UserCircle,
  Activity,
  Droplets,
  Flame,
  MapPin,
  Camera,
  Wand2,
  Loader2,
  ChevronRight,
  Upload,
  Send,
  Settings,
  Dumbbell,
  Footprints,
  ThumbsUp,
  ThumbsDown,
  Minus,
  CheckCircle2,
  Timer,
  Bike,
  BarChart3,
  Store,
  Sparkles,
  Link2,
  AlertCircle,
  LogOut,
  MoreHorizontal,
  Moon,
  List,
  X,
  ShoppingCart,
  ClipboardList,
  ArrowLeft,
  Phone
} from 'lucide-react';
import { MealRecommendation, TaskCategory, TaskItem, Order, OrderStatus } from './types';

export const ICONS = {
  Dashboard: <LayoutDashboard className="w-5 h-5" />,
  MealPlan: <UtensilsCrossed className="w-5 h-5" />,
  Profile: <UserCircle className="w-5 h-5" />,
  Admin: <Settings className="w-5 h-5" />,
  Activity: <Activity className="w-5 h-5" />,
  Water: <Droplets className="w-5 h-5" />,
  Calories: <Flame className="w-5 h-5" />,
  Location: <MapPin className="w-4 h-4" />,
  Camera: <Camera className="w-5 h-5" />,
  Magic: <Wand2 className="w-5 h-5" />,
  Loading: <Loader2 className="w-5 h-5 animate-spin" />,
  ArrowRight: <ChevronRight className="w-4 h-4" />,
  Upload: <Upload className="w-5 h-5" />,
  Send: <Send className="w-4 h-4" />,
  Dumbbell: <Dumbbell className="w-6 h-6" />,
  Footprints: <Footprints className="w-6 h-6" />,
  ThumbsUp: <ThumbsUp className="w-4 h-4" />,
  ThumbsDown: <ThumbsDown className="w-4 h-4" />,
  Minus: <Minus className="w-4 h-4" />,
  Check: <CheckCircle2 className="w-6 h-6" />,
  Timer: <Timer className="w-4 h-4" />,
  Delivery: <Bike className="w-3 h-3" />,
  Analytics: <BarChart3 className="w-5 h-5" />,
  Store: <Store className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Link: <Link2 className="w-4 h-4" />,
  Alert: <AlertCircle className="w-4 h-4" />,
  Logout: <LogOut className="w-5 h-5" />,
  More: <MoreHorizontal className="w-4 h-4" />,
  Moon: <Moon className="w-5 h-5" />,
  List: <List className="w-4 h-4" />,
  Close: <X className="w-4 h-4" />,
  ShoppingCart: <ShoppingCart className="w-5 h-5" />,
  Orders: <ClipboardList className="w-5 h-5" />,
  ArrowLeft: <ArrowLeft className="w-5 h-5" />,
  Phone: <Phone className="w-5 h-5" />
};

export const MOCK_STATS = {
  calories: { current: 1250, target: 2200 },
  steps: { current: 5430, target: 8000 },
  water: { current: 1200, target: 2500 } // ml
};

export const MOCK_TASKS: TaskItem[] = [
  {
    id: 't1',
    title: '晨間伸展 10 分鐘',
    category: TaskCategory.EXERCISE,
    isCompleted: true,
    description: '喚醒肌肉'
  },
  {
    id: 't2',
    title: '下肢肌力訓練 (深蹲)',
    category: TaskCategory.EXERCISE,
    isCompleted: false,
    description: '目標 4 組 x 12 下'
  },
  {
    id: 't3',
    title: '記錄午餐熱量',
    category: TaskCategory.NUTRITION,
    isCompleted: false,
    description: '使用 AI 拍照功能'
  },
  {
    id: 't4',
    title: '喝水目標 2000cc',
    category: TaskCategory.NUTRITION,
    isCompleted: false,
    description: '目前進度: 1200cc'
  },
  {
    id: 't5',
    title: '睡前冥想',
    category: TaskCategory.HABITS,
    isCompleted: false,
    description: '放鬆身心 10 分鐘'
  }
];

// 初始模擬資料庫
// 注意：這部分資料之後建議改由 Python Backend (如 FastAPI) 提供 API 獲取
export const MOCK_MEALS: MealRecommendation[] = [
  {
    id: 'm1',
    name: '舒肥雞胸藜麥餐盒',
    merchant: 'Muscle Fuel 健康餐',
    distance: 0.3,
    calories: 450,
    macros: { protein: 42, fat: 8, carbs: 45, sugar: 2, sodium: 450, fiber: 6 },
    imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
    price: 160
  },
  {
    id: 'm2',
    name: '香煎鮭魚五穀飯',
    merchant: 'Daily Fresh 輕食',
    distance: 1.2,
    calories: 580,
    macros: { protein: 35, fat: 18, carbs: 60, sugar: 3, sodium: 580, fiber: 7 },
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    price: 220
  },
  {
    id: 'm3',
    name: '低脂牛腱滷味拼盤',
    merchant: '老張健康滷',
    distance: 0.5,
    calories: 320,
    macros: { protein: 30, fat: 10, carbs: 15, sugar: 3, sodium: 850, fiber: 2 },
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    price: 130
  },
  {
    id: 'm4',
    name: '炙燒鮪魚波奇碗 (Poke)',
    merchant: 'Halo Poke',
    distance: 0.8,
    calories: 480,
    macros: { protein: 28, fat: 12, carbs: 55, sugar: 6, sodium: 620, fiber: 5 },
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    price: 190
  },
  {
    id: 'm5',
    name: '增肌牛肉漢堡 (無麵包)',
    merchant: 'Burger Fit',
    distance: 2.5,
    calories: 520,
    macros: { protein: 45, fat: 25, carbs: 10, sugar: 2, sodium: 680, fiber: 3 },
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    price: 200
  },
  {
    id: 'm6',
    name: '義式烤蔬菜溫沙拉',
    merchant: 'Green Day',
    distance: 0.4,
    calories: 280,
    macros: { protein: 12, fat: 15, carbs: 30, sugar: 4, sodium: 320, fiber: 9 },
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    price: 150
  },
  {
    id: 'm7',
    name: '宮保雞丁低卡餐',
    merchant: '台味輕食光',
    distance: 1.5,
    calories: 650,
    macros: { protein: 35, fat: 25, carbs: 65, sugar: 12, sodium: 950, fiber: 4 },
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
    price: 120
  },
  {
    id: 'm8',
    name: '希臘優格高蛋白碗',
    merchant: 'Yogurt House',
    distance: 0.6,
    calories: 350,
    macros: { protein: 25, fat: 5, carbs: 40, sugar: 15, sodium: 120, fiber: 5 },
    imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80',
    price: 140
  }
];

export const MOCK_ORDERS: Order[] = [
  {
    orderId: 'HG20260622001',
    storeName: 'Muscle Fuel 健康餐',
    storePhone: '02-2771-1234',
    items: [
      { itemName: '舒肥雞胸藜麥餐盒', quantity: 2, price: 160, customOptions: ['飯量減半', '去糖'], imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=80&q=80' },
      { itemName: '希臘優格高蛋白碗', quantity: 1, price: 140, imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=80&q=80' }
    ],
    totalAmount: 490,
    deliveryFee: 30,
    serviceFee: 15,
    discount: 15,
    address: '台北市大安區安和路一段165號',
    estimatedArrival: '18:40',
    createdAt: '2026-06-22T17:55:00',
    status: OrderStatus.PENDING,
    paymentMethod: 'LINE Pay',
    note: '醬料另外放'
  },
  {
    orderId: 'HG20260622002',
    storeName: 'Daily Fresh 輕食',
    storePhone: '02-2345-6789',
    items: [
      { itemName: '香煎鮭魚五穀飯', quantity: 1, price: 220, customOptions: ['加量蔬菜'], imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80' },
      { itemName: '炙燒鮪魚波奇碗', quantity: 1, price: 190, imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80' }
    ],
    totalAmount: 440,
    deliveryFee: 30,
    serviceFee: 15,
    discount: 0,
    address: '台北市信義區松仁路100號',
    estimatedArrival: '19:10',
    createdAt: '2026-06-22T18:30:00',
    status: OrderStatus.PREPARING,
    paymentMethod: 'LINE Pay',
    note: ''
  },
  {
    orderId: 'HG20260622003',
    storeName: '老張健康滷',
    storePhone: '02-2888-9999',
    items: [
      { itemName: '低脂牛腱滷味拼盤', quantity: 2, price: 130, customOptions: ['少鹽', '加滷蛋'], imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=80&q=80' }
    ],
    totalAmount: 290,
    deliveryFee: 30,
    serviceFee: 15,
    discount: 15,
    address: '台北市中山區南京東路二段88號',
    estimatedArrival: '12:30',
    createdAt: '2026-06-22T11:50:00',
    status: OrderStatus.WAITING_PICKUP,
    paymentMethod: 'LINE Pay',
    note: '大樓請打電話'
  },
  {
    orderId: 'HG20260621004',
    storeName: 'Halo Poke',
    storePhone: '02-2700-1122',
    items: [
      { itemName: '炙燒鮪魚波奇碗', quantity: 1, price: 190, imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80' },
      { itemName: '舒肥雞胸藜麥餐盒', quantity: 1, price: 160, customOptions: ['加蛋白質'], imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=80&q=80' }
    ],
    totalAmount: 380,
    deliveryFee: 30,
    serviceFee: 15,
    discount: 15,
    address: '台北市大安區復興南路一段200號',
    estimatedArrival: '13:15',
    createdAt: '2026-06-21T12:40:00',
    status: OrderStatus.DELIVERING,
    paymentMethod: 'LINE Pay',
    note: ''
  },
  {
    orderId: 'HG20260620005',
    storeName: 'Yogurt House',
    storePhone: '02-2711-3344',
    items: [
      { itemName: '希臘優格高蛋白碗', quantity: 2, price: 140, customOptions: ['加燕麥', '蜂蜜減量'], imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=80&q=80' },
      { itemName: '香煎鮭魚五穀飯', quantity: 1, price: 220, imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80' }
    ],
    totalAmount: 530,
    deliveryFee: 30,
    serviceFee: 15,
    discount: 15,
    address: '台北市松山區民生東路三段50號',
    estimatedArrival: '18:00',
    createdAt: '2026-06-20T17:20:00',
    status: OrderStatus.COMPLETED,
    paymentMethod: 'LINE Pay',
    note: '請準時送達'
  },
  {
    orderId: 'HG20260619006',
    storeName: 'Burger Fit',
    storePhone: '02-2766-5500',
    items: [
      { itemName: '增肌牛肉漢堡 (無麵包)', quantity: 1, price: 200, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=80&q=80' }
    ],
    totalAmount: 230,
    deliveryFee: 30,
    serviceFee: 15,
    discount: 15,
    address: '台北市大安區忠孝東路四段100號',
    estimatedArrival: '19:30',
    createdAt: '2026-06-19T18:45:00',
    status: OrderStatus.CANCELLED,
    paymentMethod: 'LINE Pay',
    note: '',
    cancelReason: '商家暫停營業，無法接單'
  }
];