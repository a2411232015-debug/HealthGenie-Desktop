import React, { useEffect, useState } from 'react';
import { Banknote, Bike, CheckCircle2, Clock, Info, MapPin, MessageSquare, Navigation, Phone } from 'lucide-react';
import { fetchActiveMerchantOrders, subscribeToOrders, updateOrderStatus } from '../../lib/api';
import { useAutoRefresh, useQuery } from '../../lib/useQuery';
import { Merchant, Order, OrderStatus } from '../../types';
import { estimateDelivery, navigationUrl, orderDestination, toCoordinates } from '../../utils/delivery';
import { formatTime } from '../../utils/format';
import { formatDistance } from '../../utils/geo';
import { errorMessage, showToast } from '../../utils/notifications';
import { formatCurrency } from '../../utils/pricing';
import { DeliveryMap } from '../DeliveryMap';
import { EmptyState, ErrorState, PageLoading, Spinner, card, primaryButton, secondaryButton } from '../ui';

/**
 * 外送員畫面：給店家自己的外送人員用（用手機登入店家帳號開啟）。
 * 取餐出發 → 導航 → 已送達並收款；顧客端會即時看到狀態。
 */
const CourierCard: React.FC<{ order: Order; merchant: Merchant; busy: boolean; onChange: (order: Order, status: OrderStatus) => void }> = ({ order, merchant, busy, onChange }) => {
  const store = toCoordinates(merchant.lat, merchant.lng);
  const destination = orderDestination(order);
  const estimate = estimateDelivery(order, store);
  return (
    <article className={`${card} flex flex-col gap-3 p-4`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-black leading-none text-slate-900">#{order.orderNumber.split('-')[1] || order.orderNumber}</p>
          <p className="mt-1 text-xs text-slate-400">
            {order.status === 'preparing' && order.estimatedReadyAt ? `製作中，預計 ${formatTime(order.estimatedReadyAt)} 完成` : null}
            {order.status === 'ready' && '餐點已完成，可以取餐出發'}
            {order.status === 'delivering' && `${formatTime(order.deliveringAt)} 出發`}
            {order.status === 'delivered' && `${formatTime(order.deliveredAt)} 已送達，等顧客確認`}
          </p>
        </div>
        <p className="flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-800"><Banknote className="h-4 w-4" />收 {formatCurrency(order.total)}</p>
      </header>
      <div className="space-y-1 text-sm text-slate-700">
        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{order.contactName}・<a href={`tel:${order.contactPhone}`} className="font-bold text-teal-700 hover:underline">{order.contactPhone}</a></p>
        <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{order.deliveryAddress}</p>
        <p className="flex items-center gap-2 text-xs text-slate-500"><Clock className="h-4 w-4 text-slate-400" />
          {estimate.distanceKm !== null ? `約 ${formatDistance(estimate.distanceKm)}，車程約 ${estimate.travelMinutes} 分鐘` : '顧客沒有附上定位，請依地址導航'}
        </p>
      </div>
      {order.note && <p className="flex gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />{order.note}</p>}
      {(store || destination) && <DeliveryMap store={store} destination={destination} className="h-44" />}
      <div className="flex flex-col gap-2">
        <a href={navigationUrl(order)} target="_blank" rel="noreferrer" className={secondaryButton}><Navigation className="h-4 w-4" />用 Google 地圖導航</a>
        {order.status === 'ready' && (
          <button onClick={() => onChange(order, 'delivering')} disabled={busy} className={`${primaryButton} py-3`}>{busy ? <Spinner className="h-4 w-4" /> : <Bike className="h-4 w-4" />}取餐出發</button>
        )}
        {order.status === 'delivering' && (
          <button onClick={() => onChange(order, 'delivered')} disabled={busy} className={`${primaryButton} py-3`}>{busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}已送達並收款 {formatCurrency(order.total)}</button>
        )}
      </div>
    </article>
  );
};

const SECTIONS: { key: string; title: string; statuses: OrderStatus[] }[] = [
  { key: 'ready', title: '待取餐出發', statuses: ['ready'] },
  { key: 'delivering', title: '配送中', statuses: ['delivering'] },
  { key: 'delivered', title: '已送達，等顧客確認', statuses: ['delivered'] },
  { key: 'preparing', title: '製作中（即將可以取餐）', statuses: ['preparing'] },
];

export const CourierView: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const query = useQuery(async () => (await fetchActiveMerchantOrders(merchant.id)).filter((order) => order.fulfillment === 'delivery'), [merchant.id]);
  const [busyId, setBusyId] = useState('');

  useEffect(() => subscribeToOrders({ merchantId: merchant.id }, () => void query.reload(true)), [merchant.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(() => void query.reload(true), 15000, true, true);

  const change = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      await query.reload(true);
      showToast(status === 'delivering' ? '已出發，顧客會看到配送中' : '已送達，等顧客確認收到');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
      void query.reload(true);
    } finally {
      setBusyId('');
    }
  };

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;
  const orders = query.data || [];

  return (
    <div className="space-y-6">
      <p className="flex gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        外送員專用畫面：店家的外送人員可以用手機登入店家帳號打開這一頁，取餐出發、導航、按「已送達」。目前平台沒有獨立的外送員帳號與 GPS 追蹤，顧客地圖上的外送員位置是依出發時間推算的模擬位置。
      </p>
      {!toCoordinates(merchant.lat, merchant.lng) && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">店家還沒有設定地圖位置，到「店家設定」填寫後，地圖與距離估算才會顯示。</p>}
      {orders.length === 0 ? (
        <EmptyState icon={<Bike className="h-12 w-12" />} title="目前沒有外送訂單" text="店家按下「餐點完成」後，外送訂單會出現在這裡。" />
      ) : SECTIONS.map((section) => {
        const list = orders.filter((order) => section.statuses.includes(order.status));
        if (list.length === 0) return null;
        return (
          <section key={section.key}>
            <h2 className="mb-3 font-black text-slate-900">{section.title}<span className="ml-2 rounded-full bg-slate-200 px-2 text-xs text-slate-600">{list.length}</span></h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((order) => <CourierCard key={order.id} order={order} merchant={merchant} busy={busyId === order.id} onChange={change} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
};
