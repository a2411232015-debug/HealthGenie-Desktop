import { Order } from '../types';
import { Coordinates, distanceKm } from './geo';

/**
 * 送達時間估算（簡化模型，畫面上會註明是估算）：
 *   車程 = 直線距離 × 1.3（道路繞行）÷ 機車市區平均時速 20 公里 ＋ 交餐 3 分鐘
 *   預計送達 = 餐點完成時間（店家接單時設定的製作時間）＋ 車程
 */
export const ROAD_FACTOR = 1.3;
export const RIDING_KMH = 20;
export const HANDOFF_MINUTES = 3;
/** 顧客沒有提供定位時，用這個車程估算 */
export const DEFAULT_TRAVEL_MINUTES = 15;
/** 超過這個距離提醒顧客確認店家是否外送 */
export const FAR_DISTANCE_KM = 15;

export const travelMinutesFor = (km: number | null): number =>
  km === null ? DEFAULT_TRAVEL_MINUTES : Math.max(5, Math.round(((km * ROAD_FACTOR) / RIDING_KMH) * 60 + HANDOFF_MINUTES));

export const toCoordinates = (lat: number | null | undefined, lng: number | null | undefined): Coordinates | null =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

export const orderDestination = (order: Pick<Order, 'deliveryLat' | 'deliveryLng'>): Coordinates | null =>
  toCoordinates(order.deliveryLat, order.deliveryLng);

export interface DeliveryEstimate {
  /** 店家到顧客的直線距離；任一方沒有定位時為 null */
  distanceKm: number | null;
  travelMinutes: number;
  /** 預計送達時間 */
  eta: Date | null;
  /** 預約訂單：送達時間是顧客預約的時間 */
  scheduled: boolean;
}

export const estimateDelivery = (order: Order, store: Coordinates | null, now: number = Date.now()): DeliveryEstimate => {
  const destination = orderDestination(order);
  const km = store && destination ? distanceKm(store, destination) : null;
  const travel = travelMinutesFor(km);
  const minutes = (value: number) => value * 60000;
  let eta: Date | null = null;
  if (order.deliveredAt) {
    eta = new Date(order.deliveredAt);
  } else if (order.scheduledFor && order.status !== 'delivering') {
    return { distanceKm: km, travelMinutes: travel, eta: new Date(order.scheduledFor), scheduled: true };
  } else if (order.status === 'delivering' && order.deliveringAt) {
    eta = new Date(new Date(order.deliveringAt).getTime() + minutes(travel));
  } else if (['pending', 'preparing', 'ready'].includes(order.status)) {
    const readyAt = Math.max(now, order.estimatedReadyAt ? new Date(order.estimatedReadyAt).getTime() : now);
    eta = new Date(readyAt + minutes(travel));
  }
  return { distanceKm: km, travelMinutes: travel, eta, scheduled: false };
};

/**
 * 模擬外送員位置（0 = 在店家，1 = 抵達顧客）。
 * 平台沒有外送員 GPS，所以依「出發時間」與「預估車程」推算，畫面上會標示「模擬」。
 */
export const simulatedProgress = (order: Order, travelMinutes: number, now: number = Date.now()): number => {
  if (order.status === 'delivered' || order.status === 'completed') return 1;
  if (order.status !== 'delivering' || !order.deliveringAt) return 0;
  const elapsed = (now - new Date(order.deliveringAt).getTime()) / (travelMinutes * 60000);
  return Math.min(0.95, Math.max(0, elapsed));
};

export const interpolate = (from: Coordinates, to: Coordinates, progress: number): Coordinates => ({
  lat: from.lat + (to.lat - from.lat) * progress,
  lng: from.lng + (to.lng - from.lng) * progress,
});

/** 用 Google 地圖導航到顧客（有定位用座標，沒有就用地址） */
export const navigationUrl = (order: Pick<Order, 'deliveryLat' | 'deliveryLng' | 'deliveryAddress'>): string => {
  const destination = orderDestination(order);
  const target = destination ? `${destination.lat},${destination.lng}` : order.deliveryAddress;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
};
