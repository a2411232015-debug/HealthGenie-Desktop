import React, { useEffect } from 'react';
import { ChevronRight, ClipboardList, Store } from 'lucide-react';
import { fetchMyOrders, subscribeToOrders } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useAutoRefresh, useQuery } from '../../lib/useQuery';
import { Order } from '../../types';
import { formatDateTime } from '../../utils/format';
import { formatCurrency } from '../../utils/pricing';
import { isActiveStatus, OrderStatusBadge } from '../OrderStatusBadge';
import { EmptyState, ErrorState, PageHeader, PageLoading, primaryButton } from '../ui';

const OrderRow: React.FC<{ order: Order }> = ({ order }) => {
  const active = isActiveStatus(order.status);
  return (
    <a href={`#/order/${order.id}`} className={`relative block overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${active ? 'border-teal-200' : 'border-slate-100'}`}>
      {active && <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-teal-500" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-slate-900"><Store className="h-4 w-4 text-teal-600" />{order.merchantName}</h3>
          <p className="mt-1 text-xs text-slate-400">#{order.orderNumber} · {formatDateTime(order.createdAt)} · {order.fulfillment === 'pickup' ? '自取' : '外送'}{order.scheduledFor ? ` · 預約 ${formatDateTime(order.scheduledFor)}` : ''}</p>
        </div>
        <OrderStatusBadge status={order.status} fulfillment={order.fulfillment} />
      </div>
      <p className="mt-3 line-clamp-1 text-sm text-slate-600">{order.items.map((item) => `${item.name}×${item.quantity}`).join('、')}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-black text-teal-700">{formatCurrency(order.total)}</span>
        <span className="flex items-center text-sm font-bold text-teal-700">查看<ChevronRight className="h-4 w-4" /></span>
      </div>
    </a>
  );
};

export const OrderListPage: React.FC = () => {
  const { userId } = useAuth();
  const orders = useQuery(() => fetchMyOrders(userId || ''), [userId], Boolean(userId));
  const hasActive = (orders.data || []).some((order) => isActiveStatus(order.status));

  useEffect(() => (userId ? subscribeToOrders({ customerId: userId }, () => void orders.reload(true)) : undefined), [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(() => void orders.reload(true), 20000, hasActive);

  if (orders.loading && !orders.data) return <PageLoading />;
  if (orders.error) return <ErrorState message={orders.error} onRetry={() => void orders.reload()} />;
  const list = orders.data || [];
  const active = list.filter((order) => isActiveStatus(order.status));
  const past = list.filter((order) => !isActiveStatus(order.status));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="我的訂單" />
      {list.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="還沒有訂單" action={<a href="#/stores" className={primaryButton}>去點餐</a>} />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-slate-500">進行中</h2>
              <div className="space-y-3">{active.map((order) => <OrderRow key={order.id} order={order} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-slate-500">歷史訂單</h2>
              <div className="space-y-3">{past.map((order) => <OrderRow key={order.id} order={order} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
