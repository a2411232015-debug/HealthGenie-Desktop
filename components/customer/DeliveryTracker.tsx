import React, { useEffect, useState } from 'react';
import { Bike, Info } from 'lucide-react';
import { Order } from '../../types';
import { estimateDelivery, interpolate, orderDestination, simulatedProgress } from '../../utils/delivery';
import { Coordinates, formatDistance } from '../../utils/geo';
import { formatDateTime, formatTime } from '../../utils/format';
import { DeliveryMap } from '../DeliveryMap';

/** 顧客的外送追蹤：預計送達時間 + 地圖（外送員位置為模擬） */
export const DeliveryTracker: React.FC<{ order: Order; store: Coordinates | null }> = ({ order, store }) => {
  const [now, setNow] = useState(() => Date.now());
  const moving = order.status === 'delivering';
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), moving ? 5000 : 30000);
    return () => window.clearInterval(timer);
  }, [moving]);

  const destination = orderDestination(order);
  const estimate = estimateDelivery(order, store, now);
  const progress = simulatedProgress(order, estimate.travelMinutes, now);
  const courier = moving && store && destination ? interpolate(store, destination, progress) : null;
  const late = moving && estimate.eta !== null && estimate.eta.getTime() < now;

  let headline = '';
  if (order.status === 'delivered' || order.status === 'completed') headline = `已於 ${formatTime(order.deliveredAt || order.completedAt)} 送達`;
  else if (estimate.scheduled && estimate.eta) headline = `預約 ${formatDateTime(estimate.eta.toISOString())} 送達`;
  else if (late) headline = '外送員即將抵達';
  else if (estimate.eta) headline = `預計 ${formatTime(estimate.eta.toISOString())} 送達`;

  return (
    <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-black text-slate-900"><Bike className="h-5 w-5 text-teal-600" />外送追蹤</h3>
        {headline && <p className="text-lg font-black text-teal-700">{headline}</p>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {estimate.distanceKm !== null
          ? `距離約 ${formatDistance(estimate.distanceKm)} · 車程約 ${estimate.travelMinutes} 分鐘`
          : `下單時沒有附上定位，以車程 ${estimate.travelMinutes} 分鐘估算`}
        {order.status === 'pending' && ' · 店家接單並設定製作時間後會更新'}
      </p>
      {(store || destination) && <DeliveryMap store={store} destination={destination} courier={courier} courierLabel="外送員（模擬）" className="mt-3 h-56" />}
      <p className="mt-2 flex gap-1.5 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        預計送達＝店家設定的製作時間＋車程（直線距離 × 1.3 ÷ 機車時速 20 公里＋交餐 3 分鐘）。平台沒有外送員 GPS，地圖上的外送員位置是依出發時間推算的模擬位置。
      </p>
    </section>
  );
};
