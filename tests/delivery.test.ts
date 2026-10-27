import { describe, expect, test } from 'vitest';
import { Order } from '../types';
import { estimateDelivery, interpolate, navigationUrl, simulatedProgress, travelMinutesFor } from '../utils/delivery';

const store = { lat: 24.1500, lng: 120.6800 };
// 約往北 2 公里
const home = { lat: 24.1680, lng: 120.6800 };

const baseOrder = (patch: Partial<Order> = {}): Order => ({
  id: 'o1', orderNumber: '261027-0001', customerId: 'c', merchantId: 'm', status: 'preparing', fulfillment: 'delivery',
  items: [], itemCount: 1, subtotal: 150, deliveryFee: 30, serviceFee: 0, discount: 0, total: 180,
  merchantName: '店', merchantPhone: '0422222222', merchantAddress: '台中市', contactName: '小陳', contactPhone: '0912345678',
  deliveryAddress: '台中市北區三民路三段129號', note: '', paymentMethod: 'cash', paymentStatus: 'unpaid',
  estimatedReadyAt: '2026-10-27T04:20:00Z', scheduledFor: null, statusHistory: [], cancelReason: '',
  createdAt: '2026-10-27T04:00:00Z', completedAt: null,
  deliveryLat: home.lat, deliveryLng: home.lng, prepMinutes: 20, deliveringAt: null, deliveredAt: null,
  ...patch,
});

describe('travelMinutesFor', () => {
  test('2 公里：2 × 1.3 ÷ 20 × 60 + 3 ≈ 11 分鐘', () => expect(travelMinutesFor(2)).toBe(11));
  test('很近也至少 5 分鐘', () => expect(travelMinutesFor(0.1)).toBe(5));
  test('沒有定位用 15 分鐘估算', () => expect(travelMinutesFor(null)).toBe(15));
});

describe('estimateDelivery', () => {
  const now = new Date('2026-10-27T04:05:00Z').getTime();
  test('製作中：預計送達 = 預計完成時間 + 車程', () => {
    const estimate = estimateDelivery(baseOrder(), store, now);
    expect(estimate.distanceKm).toBeCloseTo(2, 0);
    expect(estimate.eta?.toISOString()).toBe(new Date(new Date('2026-10-27T04:20:00Z').getTime() + estimate.travelMinutes * 60000).toISOString());
  });
  test('配送中：預計送達 = 出發時間 + 車程', () => {
    const estimate = estimateDelivery(baseOrder({ status: 'delivering', deliveringAt: '2026-10-27T04:25:00Z' }), store, now);
    expect(estimate.eta?.toISOString()).toBe(new Date(new Date('2026-10-27T04:25:00Z').getTime() + estimate.travelMinutes * 60000).toISOString());
  });
  test('已送達：顯示實際送達時間', () => {
    expect(estimateDelivery(baseOrder({ status: 'delivered', deliveredAt: '2026-10-27T04:40:00Z' }), store, now).eta?.toISOString()).toBe('2026-10-27T04:40:00.000Z');
  });
  test('預約訂單：以預約時間為準', () => {
    const estimate = estimateDelivery(baseOrder({ scheduledFor: '2026-10-28T04:00:00Z' }), store, now);
    expect(estimate.scheduled).toBe(true);
    expect(estimate.eta?.toISOString()).toBe('2026-10-28T04:00:00.000Z');
  });
  test('沒有定位：距離未知，用預設車程', () => {
    const estimate = estimateDelivery(baseOrder({ deliveryLat: null, deliveryLng: null }), store, now);
    expect(estimate.distanceKm).toBeNull();
    expect(estimate.travelMinutes).toBe(15);
  });
});

describe('simulatedProgress', () => {
  const order = baseOrder({ status: 'delivering', deliveringAt: '2026-10-27T04:00:00Z' });
  test('出發一半時間，模擬位置在一半', () => expect(simulatedProgress(order, 10, new Date('2026-10-27T04:05:00Z').getTime())).toBeCloseTo(0.5));
  test('超過預估時間也不會顯示已抵達', () => expect(simulatedProgress(order, 10, new Date('2026-10-27T05:00:00Z').getTime())).toBe(0.95));
  test('還沒出發停在店家', () => expect(simulatedProgress(baseOrder(), 10)).toBe(0));
  test('已送達在顧客位置', () => expect(simulatedProgress(baseOrder({ status: 'delivered' }), 10)).toBe(1));
  test('內插座標', () => expect(interpolate(store, home, 0.5).lat).toBeCloseTo(24.159));
});

describe('navigationUrl', () => {
  test('有定位用座標導航', () => expect(navigationUrl(baseOrder())).toContain('destination=24.168%2C120.68'));
  test('沒有定位用地址導航', () => expect(navigationUrl(baseOrder({ deliveryLat: null, deliveryLng: null }))).toContain(encodeURIComponent('台中市北區')));
});
