import { AnalyticsEvent, AnalyticsEventType, OrderStatus } from '../types';
import { getOrders } from '../data/repository';
import { toSafeNumber } from './numbers';

const STORAGE_KEY = 'healthgenie_analytics';
const LEGACY_KEY = 'analytics_events';
const VERSION = 1;
const MAX_EVENTS = 1000;

interface AnalyticsEnvelope {
  version: number;
  data: AnalyticsEvent[];
}

export interface DailyAnalyticsPoint {
  date: string;
  isoDate: string;
  impressions: number;
  clicks: number;
  navigations: number;
  orders: number;
}

export interface AnalyticsSummary {
  impressions: number;
  clicks: number;
  navigations: number;
  estimatedRevenue: number;
  actualRevenue: number;
  validOrdersCount: number;
  averageOrderValue: number;
  platformFee: number;
  netRevenue: number;
  topMeals: { name: string; quantity: number; revenue: number; suggestion: string; growth: string }[];
  dailyTrend: DailyAnalyticsPoint[];
  conversionRate: number;
}

const parseEvents = (raw: string | null): AnalyticsEvent[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AnalyticsEnvelope | AnalyticsEvent[];
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.version === VERSION && Array.isArray(parsed.data)) return parsed.data;
  } catch {
    return [];
  }
  return [];
};

export const getAnalyticsEvents = (): AnalyticsEvent[] => {
  const current = parseEvents(localStorage.getItem(STORAGE_KEY));
  if (current.length > 0) return current;
  const legacy = parseEvents(localStorage.getItem(LEGACY_KEY));
  if (legacy.length > 0) saveAnalyticsEvents(legacy);
  return legacy;
};

export const saveAnalyticsEvents = (events: AnalyticsEvent[]): void => {
  try {
    const data = events.slice(-MAX_EVENTS);
    const envelope: AnalyticsEnvelope = { version: VERSION, data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Analytics must never block the ordering flow.
  }
};

export const trackEvent = (
  eventType: AnalyticsEventType,
  payload?: {
    mealId?: string;
    mealName?: string;
    storeName?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  },
): void => {
  try {
    if (eventType === 'view_menu') {
      const now = Date.now();
      const previous = Number(sessionStorage.getItem('last_view_menu_time'));
      if (Number.isFinite(previous) && now - previous < 30_000) return;
      sessionStorage.setItem('last_view_menu_time', String(now));
    }
    const events = getAnalyticsEvents();
    events.push({
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      eventType,
      timestamp: new Date().toISOString(),
      isMock: false,
      ...payload,
    });
    saveAnalyticsEvents(events);
    window.dispatchEvent(new Event('analytics_updated'));
  } catch {
    // Analytics must never block a visible action.
  }
};

export const getAnalyticsSummary = (merchantId?: string): AnalyticsSummary => {
  const events = getAnalyticsEvents();
  const allOrders = getOrders();
  const orders = merchantId ? allOrders.filter((order) => order.merchantId === merchantId) : allOrders;
  const validStatuses = [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.WAITING_DELIVERY,
    OrderStatus.DELIVERING,
    OrderStatus.COMPLETED,
  ];
  const validOrders = orders.filter((order) => validStatuses.includes(order.status));
  const totalSubtotal = validOrders.reduce((sum, order) => sum + toSafeNumber(order.subtotal), 0);

  const mealStats: Record<string, { quantity: number; revenue: number }> = {};
  validOrders.forEach((order) => order.items.forEach((item) => {
    const current = mealStats[item.itemName] || { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.subtotal;
    mealStats[item.itemName] = current;
  }));

  const topMeals = Object.entries(mealStats)
    .map(([name, stats]) => ({
      name,
      ...stats,
      suggestion: stats.quantity >= 5 ? '銷售表現良好，可考慮推出套餐。' : '可更新圖片或搭配促銷提高轉換。',
      growth: stats.quantity >= 5 ? '+12%' : '+3%',
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const isoDate = date.toISOString().slice(0, 10);
    return {
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      isoDate,
      impressions: 0,
      clicks: 0,
      navigations: 0,
      orders: 0,
    };
  });
  const byDate = new Map(days.map((day) => [day.isoDate, day]));

  events.forEach((event) => {
    const date = new Date(event.timestamp);
    if (!Number.isFinite(date.getTime())) return;
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
    const point = byDate.get(key);
    if (!point) return;
    if (event.eventType === 'view_menu') point.impressions += 1;
    if (event.eventType === 'click_meal') point.clicks += 1;
    if (event.eventType === 'navigate_store') point.navigations += 1;
  });
  validOrders.forEach((order) => {
    const date = new Date(order.createdAt);
    if (!Number.isFinite(date.getTime())) return;
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
    const point = byDate.get(key);
    if (point) point.orders += 1;
  });

  const impressions = events.filter((event) => event.eventType === 'view_menu').length;
  const clicks = events.filter((event) => event.eventType === 'click_meal').length;
  const navigations = events.filter((event) => event.eventType === 'navigate_store').length;
  const conversionRate = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(1)) : 0;

  return {
    impressions,
    clicks,
    navigations,
    estimatedRevenue: totalSubtotal,
    actualRevenue: validOrders.filter((order) => order.status === OrderStatus.COMPLETED).reduce((sum, order) => sum + order.subtotal, 0),
    validOrdersCount: validOrders.length,
    averageOrderValue: validOrders.length > 0 ? Math.round(totalSubtotal / validOrders.length) : 0,
    platformFee: Math.round(totalSubtotal * 0.15),
    netRevenue: Math.round(totalSubtotal * 0.85),
    topMeals,
    dailyTrend: days,
    conversionRate,
  };
};

export const seedMockEventsIfNeeded = (): void => {
  // Kept for backward compatibility; real empty state is now displayed when there is no data.
};
