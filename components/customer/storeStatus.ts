import { Merchant } from '../../types';
import { isOpenAt, upcomingSlots } from '../../utils/hours';

export type StoreState = 'open' | 'closed' | 'paused';

export const storeState = (merchant: Merchant, now: Date = new Date()): StoreState => {
  if (!merchant.acceptingOrders) return 'paused';
  return isOpenAt(merchant.openingHours, now) ? 'open' : 'closed';
};

export const STORE_STATE_LABEL: Record<StoreState, string> = {
  open: '營業中',
  closed: '休息中',
  paused: '暫停接單',
};

/** now：現在可以下單；preorder：現在休息但可以預約；unavailable：暫停接單或沒有可預約時段 */
export type OrderingMode = 'now' | 'preorder' | 'unavailable';

export const orderingMode = (merchant: Merchant, now: Date = new Date()): OrderingMode => {
  const state = storeState(merchant, now);
  if (state === 'paused') return 'unavailable';
  if (state === 'open') return 'now';
  return upcomingSlots(merchant.openingHours, merchant.prepMinutes, now).length > 0 ? 'preorder' : 'unavailable';
};
