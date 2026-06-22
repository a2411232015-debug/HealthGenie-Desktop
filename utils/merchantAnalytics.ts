import { Order, OrderStatus, AnalyticsEvent, AnalyticsEventType } from '../types';

const STORAGE_KEY = 'analytics_events';
const MAX_EVENTS = 1000;

export const getAnalyticsEvents = (): AnalyticsEvent[] => {
  try {
    const rawEvents = localStorage.getItem(STORAGE_KEY);
    if (rawEvents) {
      const parsed = JSON.parse(rawEvents);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to parse analytics_events from localStorage', error);
  }
  return [];
};

export const saveAnalyticsEvents = (events: AnalyticsEvent[]): void => {
  try {
    // Keep only last MAX_EVENTS to avoid localStorage bloat
    let eventsToSave = events;
    if (eventsToSave.length > MAX_EVENTS) {
      eventsToSave = eventsToSave.slice(eventsToSave.length - MAX_EVENTS);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsToSave));
  } catch (error) {
    console.error('Failed to save analytics_events to localStorage', error);
  }
};

export const trackEvent = (
  eventType: AnalyticsEventType,
  payload?: {
    mealId?: string;
    mealName?: string;
    storeName?: string;
    amount?: number;
    metadata?: Record<string, any>;
  }
): void => {
  try {
    // Session debounce for view_menu
    if (eventType === 'view_menu') {
      const lastViewMenuTime = sessionStorage.getItem('last_view_menu_time');
      const now = Date.now();
      if (lastViewMenuTime && now - parseInt(lastViewMenuTime) < 30000) {
        return; // Ignore if within 30 seconds
      }
      sessionStorage.setItem('last_view_menu_time', now.toString());
    }

    const events = getAnalyticsEvents();
    
    const newEvent: AnalyticsEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      eventType,
      timestamp: new Date().toISOString(),
      isMock: false,
      ...payload
    };

    events.push(newEvent);
    saveAnalyticsEvents(events);
    window.dispatchEvent(new Event('analytics_updated'));
  } catch (error) {
    console.error('Failed to track event', error);
  }
};

export const seedMockEventsIfNeeded = (): void => {
  try {
    const rawEvents = localStorage.getItem(STORAGE_KEY);
    if (rawEvents && JSON.parse(rawEvents).length > 0) return;

    const mockEvents: AnalyticsEvent[] = [];
    const now = new Date();
    
    // Generate events over the last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      
      const views = Math.floor(100 + Math.random() * 200);
      const clicks = Math.floor(views * 0.15);
      const navs = Math.floor(clicks * 0.2);
      const addCart = Math.floor(clicks * 0.5);
      const orders = Math.floor(addCart * 0.5);

      const addMockEvent = (type: AnalyticsEventType, timeOffsetHours: number, amount?: number) => {
        const t = new Date(date);
        t.setHours(timeOffsetHours);
        mockEvents.push({
          eventId: `m_${type}_${i}_${Math.random().toString(36).substring(2, 9)}`,
          eventType: type,
          timestamp: t.toISOString(),
          isMock: true,
          amount
        });
      };

      for (let j = 0; j < views; j++) addMockEvent('view_menu', Math.floor(Math.random() * 24));
      for (let j = 0; j < clicks; j++) addMockEvent('click_meal', Math.floor(Math.random() * 24));
      for (let j = 0; j < navs; j++) addMockEvent('navigate_store', Math.floor(Math.random() * 24));
      for (let j = 0; j < addCart; j++) addMockEvent('add_to_cart', Math.floor(Math.random() * 24));
      for (let j = 0; j < orders; j++) addMockEvent('order_created', Math.floor(Math.random() * 24), Math.floor(100 + Math.random() * 300));
    }

    // Sort by timestamp
    mockEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    saveAnalyticsEvents(mockEvents);
  } catch (error) {
    console.error('Failed to seed mock events', error);
  }
};

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
  trafficTrend: number[];
  conversionRate: number;
}

export const getAnalyticsSummary = (): AnalyticsSummary => {
  const events = getAnalyticsEvents();

  let orders: Order[] = [];
  try {
    const rawOrders = localStorage.getItem('user_orders');
    if (rawOrders) {
      const parsed = JSON.parse(rawOrders);
      if (Array.isArray(parsed)) {
        orders = parsed;
      }
    }
  } catch (e) {
    console.error(e);
  }

  const impressions = events.filter(e => e.eventType === 'view_menu' || e.eventType === 'click_meal').length;
  const clicks = events.filter(e => e.eventType === 'click_meal' || e.eventType === 'navigate_store').length;
  const navigations = events.filter(e => e.eventType === 'navigate_store').length;

  let estimatedRevenue = 0;
  let actualRevenue = 0;
  let validOrdersCount = 0;
  let totalSubtotal = 0;

  const validStatuses = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.WAITING_PICKUP, OrderStatus.DELIVERING, OrderStatus.COMPLETED];

  orders.forEach(order => {
    if (validStatuses.includes(order.status)) {
      const subtotal = order.totalAmount - (order.deliveryFee || 0) - (order.serviceFee || 0) + (order.discount || 0);
      estimatedRevenue += subtotal;
      validOrdersCount++;
      totalSubtotal += subtotal;

      if (order.status === OrderStatus.COMPLETED) {
        actualRevenue += subtotal;
      }
    }
  });

  const averageOrderValue = validOrdersCount > 0 ? Math.round(totalSubtotal / validOrdersCount) : 0;
  const platformFee = Math.round(totalSubtotal * 0.15);
  const netRevenue = Math.round(totalSubtotal * 0.85);

  const mealStats: Record<string, { quantity: number; revenue: number }> = {};
  orders.forEach(order => {
    if (order.status !== OrderStatus.CANCELLED) {
      order.items.forEach(item => {
        if (!mealStats[item.itemName]) {
          mealStats[item.itemName] = { quantity: 0, revenue: 0 };
        }
        mealStats[item.itemName].quantity += item.quantity;
        mealStats[item.itemName].revenue += (item.price * item.quantity);
      });
    }
  });

  const generateGrowthAndSuggestion = (name: string, quantity: number) => {
    // Determine growth pseudo-randomly but consistently based on string char code
    let charSum = 0;
    for(let i=0; i<name.length; i++) {
        charSum += name.charCodeAt(i);
    }
    const isPositive = charSum % 2 === 0;
    const rate = 5 + (charSum % 15);
    const growth = isPositive ? `+${rate}%` : `-${rate}%`;

    let suggestion = '';
    if (quantity > 10) suggestion = '銷售表現極佳，建議推出大份量或套餐組合';
    else if (isPositive) suggestion = '近期人氣上升，建議搭配促銷活動';
    else suggestion = '點擊佳但下單率待提升，建議更新餐點圖片或微調價格';

    return { growth, suggestion };
  };

  const topMeals = Object.entries(mealStats)
    .map(([name, stats]) => ({
      name,
      quantity: stats.quantity,
      revenue: stats.revenue,
      ...generateGrowthAndSuggestion(name, stats.quantity)
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Traffic Trend over last 7 days
  const trafficTrend = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  events.forEach(e => {
    if (e.eventType === 'view_menu' || e.eventType === 'click_meal') {
      const eDate = new Date(e.timestamp);
      const diffTime = Math.abs(now.getTime() - eDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        trafficTrend[6 - diffDays]++; // 0 is oldest, 6 is today
      }
    }
  });

  const maxTrend = Math.max(...trafficTrend);
  const finalTrend = maxTrend === 0 ? [45, 62, 58, 85, 92, 115, 128] : trafficTrend;

  const conversionRateRaw = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const conversionRate = isNaN(conversionRateRaw) ? 0 : Number(conversionRateRaw.toFixed(1));

  return {
    impressions,
    clicks,
    navigations,
    estimatedRevenue,
    actualRevenue,
    validOrdersCount,
    averageOrderValue,
    platformFee,
    netRevenue,
    topMeals,
    trafficTrend: finalTrend,
    conversionRate
  };
};
