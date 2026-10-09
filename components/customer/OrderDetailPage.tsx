import React, { useEffect, useState } from 'react';
import { BookPlus, Check, Clock, MapPin, Phone, RotateCcw, Store } from 'lucide-react';
import { addFoodLog, fetchLoggedOrderIds, fetchOrder, fetchProducts, fetchMerchant, subscribeToOrders, updateOrderStatus } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addToCart, buildCartItem, clearCart } from '../../lib/cart';
import { notifyFoodLogsUpdated } from '../../lib/health';
import { navigate } from '../../lib/router';
import { useAutoRefresh, useQuery } from '../../lib/useQuery';
import { Order } from '../../types';
import { formatDateTime, formatTime } from '../../utils/format';
import { errorMessage, showToast } from '../../utils/notifications';
import { addNutrition, emptyNutrition, formatCurrency } from '../../utils/pricing';
import { OrderProgressTimeline } from '../OrderProgressTimeline';
import { isActiveStatus, OrderStatusBadge } from '../OrderStatusBadge';
import { ConfirmDialog, ErrorState, PageHeader, PageLoading, Spinner, card, secondaryButton } from '../ui';
import { storeState } from './storeStatus';

const orderNutrition = (order: Order) => {
  const complete = order.items.every((item) => item.unitNutrition);
  const total = order.items.reduce((sum, item) => addNutrition(sum, item.unitNutrition, item.quantity), emptyNutrition());
  return { total, complete, any: order.items.some((item) => item.unitNutrition) };
};

export const OrderDetailPage: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { userId } = useAuth();
  const query = useQuery(async () => {
    const order = await fetchOrder(orderId);
    const logged = order ? await fetchLoggedOrderIds([order.id]) : new Set<string>();
    return { order, logged: logged.has(orderId) };
  }, [orderId]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<'' | 'cancel' | 'log' | 'reorder'>('');
  const order = query.data?.order;
  const active = order ? isActiveStatus(order.status) : false;

  useEffect(() => (userId ? subscribeToOrders({ customerId: userId }, () => void query.reload(true)) : undefined), [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(() => void query.reload(true), 15000, active);

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;
  if (!order) return <ErrorState message="找不到這張訂單" onRetry={() => navigate('/orders')} />;

  const nutrition = orderNutrition(order);

  const cancel = async () => {
    setBusy('cancel');
    try {
      const next = await updateOrderStatus(order.id, 'cancelled', '顧客取消訂單');
      query.setData((current) => ({ logged: current?.logged || false, order: next }));
      showToast('訂單已取消');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
      void query.reload(true);
    } finally {
      setBusy('');
      setConfirmCancel(false);
    }
  };

  const logMeal = async () => {
    setBusy('log');
    try {
      await addFoodLog({
        name: `${order.merchantName}：${order.items.map((item) => item.name).join('、')}`.slice(0, 60),
        calories: Math.round(nutrition.total.calories),
        protein: nutrition.total.protein,
        fat: nutrition.total.fat,
        carbs: nutrition.total.carbs,
        source: 'order',
        orderId: order.id,
        eatenAt: order.completedAt || undefined,
      });
      notifyFoodLogsUpdated();
      query.setData((current) => ({ order: current?.order || order, logged: true }));
      showToast('已記錄到今天的飲食');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusy('');
    }
  };

  const reorder = async () => {
    setBusy('reorder');
    try {
      const merchant = await fetchMerchant(order.merchantId);
      if (!merchant || storeState(merchant) === 'paused') throw new Error('店家目前無法接單');
      const products = await fetchProducts([merchant.id]);
      clearCart();
      let added = 0;
      order.items.forEach((item) => {
        const product = products.find((candidate) => candidate.id === item.productId && candidate.available);
        if (!product) return;
        addToCart(merchant, buildCartItem(product, item.options.map((option) => option.optionId), item.quantity, item.remark), true);
        added += 1;
      });
      if (added === 0) throw new Error('這張訂單的餐點都已售完或下架');
      showToast(added < order.items.length ? '部分餐點已售完，其餘已加入購物車' : '已加入購物車');
      navigate('/cart');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="訂單詳情" subtitle={`#${order.orderNumber} · ${formatDateTime(order.createdAt)}`} back={() => navigate('/orders')} />

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <OrderStatusBadge status={order.status} fulfillment={order.fulfillment} />
          {order.scheduledFor ? (
            <p className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-800"><Clock className="h-4 w-4" />預約 {formatDateTime(order.scheduledFor)} {order.fulfillment === 'pickup' ? '取餐' : '送達'}</p>
          ) : active && order.estimatedReadyAt && (
            <p className="flex items-center gap-1.5 text-sm font-bold text-teal-700"><Clock className="h-4 w-4" />預計 {formatTime(order.estimatedReadyAt)} 完成</p>
          )}
        </div>
        {order.status === 'pending' && <p className="mt-3 text-sm text-slate-600">店家確認訂單後就會開始製作，這個頁面會自動更新。</p>}
        {order.status === 'ready' && order.fulfillment === 'pickup' && (
          <p className="mt-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">餐點已完成！請到店取餐，告訴店家取餐號碼 <span className="text-lg">{order.orderNumber.split('-')[1]}</span>，並以現金付款 {formatCurrency(order.total)}。</p>
        )}
        {(order.status === 'cancelled' || order.status === 'rejected') && (
          <p className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{order.status === 'rejected' ? '店家無法接這張訂單' : '訂單已取消'}{order.cancelReason ? `：${order.cancelReason}` : ''}</p>
        )}
        <div className="mt-5"><OrderProgressTimeline status={order.status} fulfillment={order.fulfillment} history={order.statusHistory} /></div>
        <div className="mt-5 flex flex-wrap gap-2">
          {order.status === 'pending' && (
            <button onClick={() => setConfirmCancel(true)} className={`${secondaryButton} text-red-600`} disabled={Boolean(busy)}>取消訂單</button>
          )}
          {order.status === 'completed' && nutrition.any && (
            query.data?.logged
              ? <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700"><Check className="h-4 w-4" />已記錄到飲食日誌</span>
              : <button onClick={logMeal} className={secondaryButton} disabled={Boolean(busy)}>{busy === 'log' ? <Spinner className="h-4 w-4" /> : <BookPlus className="h-4 w-4" />}記錄到飲食日誌</button>
          )}
          {!active && (
            <button onClick={reorder} className={secondaryButton} disabled={Boolean(busy)}>{busy === 'reorder' ? <Spinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}再點一次</button>
          )}
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="flex items-center gap-2 font-black text-slate-900"><Store className="h-5 w-5 text-teal-600" />{order.merchantName}</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /><a href={`tel:${order.merchantPhone}`} className="font-bold text-teal-700 hover:underline">{order.merchantPhone}</a></p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-slate-400" />{order.fulfillment === 'pickup' ? `自取：${order.merchantAddress}` : `外送到：${order.deliveryAddress}`}</p>
        </div>
        <ul className="mt-4 divide-y divide-slate-100">
          {order.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="py-3 text-sm">
              <div className="flex justify-between gap-3 font-bold text-slate-800"><span>{item.name} × {item.quantity}</span><span>{formatCurrency(item.subtotal)}</span></div>
              {item.options.length > 0 && <p className="text-xs text-slate-500">{item.options.map((option) => option.name).join('、')}</p>}
              {item.remark && <p className="text-xs text-slate-500">備註：{item.remark}</p>}
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm text-slate-600">
          <div className="flex justify-between"><dt>小計</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
          {order.deliveryFee > 0 && <div className="flex justify-between"><dt>外送費</dt><dd>{formatCurrency(order.deliveryFee)}</dd></div>}
          {order.serviceFee > 0 && <div className="flex justify-between"><dt>服務費</dt><dd>{formatCurrency(order.serviceFee)}</dd></div>}
          {order.discount > 0 && <div className="flex justify-between text-emerald-600"><dt>店家折扣</dt><dd>-{formatCurrency(order.discount)}</dd></div>}
          <div className="flex justify-between pt-1 text-lg font-black text-slate-900"><dt>合計</dt><dd>{formatCurrency(order.total)}</dd></div>
          <div className="flex justify-between text-xs"><dt>付款</dt><dd>現金 · {order.paymentStatus === 'paid' ? '已付款' : '尚未付款'}</dd></div>
        </dl>
        {order.note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">訂單備註：{order.note}</p>}
        {nutrition.any && <p className="mt-3 text-xs text-slate-400">這張訂單約 {Math.round(nutrition.total.calories)} kcal、蛋白質 {Math.round(nutrition.total.protein)} g{nutrition.complete ? '' : '（部分餐點未提供營養資訊）'}</p>}
      </section>

      {confirmCancel && (
        <ConfirmDialog title="取消這張訂單？" message="店家還沒接單，現在可以直接取消。" confirmLabel="確定取消" danger busy={busy === 'cancel'} onCancel={() => setConfirmCancel(false)} onConfirm={cancel} />
      )}
    </div>
  );
};
