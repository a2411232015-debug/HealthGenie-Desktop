import { Merchant } from '../../types';
import { isOpenAt } from '../../utils/hours';

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
