import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, Bike, ClipboardList, MapPin, MessageSquare, Phone, ShoppingBag } from 'lucide-react';
import { fetchActiveMerchantOrders, fetchMerchantOrders, subscribeToOrders, updateOrderStatus } from '../../lib/api';
import { useAutoRefresh, useQuery } from '../../lib/useQuery';
import { Merchant, Order, OrderStatus } from '../../types';
import { formatTime, minutesAgo, startOfTaipeiDay } from '../../utils/format';
import {
  errorMessage,
  playNewOrderSound,
  requestDesktopNotifications,
  showDesktopNotification,
  showToast,
  unlockAudio,
} from '../../utils/notifications';
import { formatCurrency } from '../../utils/pricing';
import { OrderStatusBadge } from '../OrderStatusBadge';
import { EmptyState, ErrorState, PageLoading, ReasonDialog, Spinner, card, primaryButton, secondaryButton } from '../ui';

type Tab = 'pending' | 'preparing' | 'ready' | 'delivering' | 'done';
const ALERT_KEY = 'healthgenie_order_alerts';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '新訂單' },
  { key: 'preparing', label: '製作中' },
  { key: 'ready', label: '待取餐／待配送' },
  { key: 'delivering', label: '配送中' },
  { key: 'done', label: '今日已結束' },
];

interface Action {
  status: OrderStatus;
  label: string;
  primary?: boolean;
  needsReason?: boolean;
}

const actionsFor = (order: Order): Action[] => {
  switch (order.status) {
    case 'pending':
      return [{ status: 'preparing', label: '接單，開始製作', primary: true }, { status: 'rejected', label: '無法接單', needsReason: true }];
    case 'preparing':
      return [{ status: 'ready', label: order.fulfillment === 'pickup' ? '餐點完成，通知取餐' : '餐點完成', primary: true }, { status: 'cancelled', label: '取消訂單', needsReason: true }];
    case 'ready':
      return order.fulfillment === 'delivery'
        ? [{ status: 'delivering', label: '出發配送', primary: true }, { status: 'cancelled', label: '取消訂單', needsReason: true }]
        : [{ status: 'completed', label: `顧客已取餐並付款 ${formatCurrency(order.total)}`, primary: true }, { status: 'cancelled', label: '顧客未取餐', needsReason: true }];
    case 'delivering':
      return [{ status: 'completed', label: `已送達並收款 ${formatCurrency(order.total)}`, primary: true }];
    default:
      return [];
  }
};

const OrderTicket: React.FC<{ order: Order; busy: boolean; onAction: (order: Order, action: Action) => void }> = ({ order, busy, onAction }) => (
  <article className={`${card} flex flex-col p-4 ${order.status === 'pending' ? 'border-orange-300 ring-2 ring-orange-100' : ''}`}>
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="text-3xl font-black leading-none text-slate-900">#{order.orderNumber.split('-')[1] || order.orderNumber}</p>
        <p className="mt-1 text-xs text-slate-400">{formatTime(order.createdAt)} 下單 · {minutesAgo(order.createdAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <OrderStatusBadge status={order.status} fulfillment={order.fulfillment} />
        <span className={`flex items-center gap-1 text-xs font-bold ${order.fulfillment === 'delivery' ? 'text-blue-700' : 'text-teal-700'}`}>
          {order.fulfillment === 'delivery' ? <><Bike className="h-3.5 w-3.5" />外送</> : <><ShoppingBag className="h-3.5 w-3.5" />自取</>}
        </span>
      </div>
    </header>
    <div className="mt-3 space-y-1 text-sm text-slate-600">
      <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{order.contactName}・<a href={`tel:${order.contactPhone}`} className="font-bold text-teal-700 hover:underline">{order.contactPhone}</a></p>
      {order.fulfillment === 'delivery' && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{order.deliveryAddress}</p>}
    </div>
    <ul className="mt-3 space-y-2 border-t border-dashed border-slate-200 pt-3">
      {order.items.map((item, index) => (
        <li key={`${item.productId}-${index}`} className="text-sm">
          <p className="font-bold text-slate-900"><span className="mr-1 text-teal-700">{item.quantity}×</span>{item.name}</p>
          {item.options.length > 0 && <p className="text-xs text-slate-600">{item.options.map((option) => option.name).join('、')}</p>}
          {item.remark && <p className="text-xs font-bold text-orange-700">備註：{item.remark}</p>}
        </li>
      ))}
    </ul>
    {order.note && <p className="mt-3 flex gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />{order.note}</p>}
    {order.cancelReason && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">原因：{order.cancelReason}</p>}
    <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm">
      <span className="text-slate-500">現金 · {order.paymentStatus === 'paid' ? '已收款' : '未收款'}</span>
      <span className="font-black text-slate-900">{formatCurrency(order.total)}</span>
    </p>
    {actionsFor(order).length > 0 && (
      <div className="mt-4 flex flex-col gap-2">
        {actionsFor(order).map((action) => (
          <button key={action.status} onClick={() => onAction(order, action)} disabled={busy} className={action.primary ? `${primaryButton} py-3` : `${secondaryButton} text-red-600`}>
            {busy && action.primary && <Spinner className="h-4 w-4" />}{action.label}
          </button>
        ))}
      </div>
    )}
  </article>
);

export const MerchantOrders: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const query = useQuery(async () => {
    const [active, today] = await Promise.all([
      fetchActiveMerchantOrders(merchant.id),
      fetchMerchantOrders(merchant.id, startOfTaipeiDay()),
    ]);
    return { active, done: today.filter((order) => ['completed', 'cancelled', 'rejected'].includes(order.status)) };
  }, [merchant.id]);
  const [tab, setTab] = useState<Tab>('pending');
  const [busyId, setBusyId] = useState('');
  const [reasonFor, setReasonFor] = useState<{ order: Order; action: Action } | null>(null);
  const [alertsOn, setAlertsOn] = useState(() => {
    try { return localStorage.getItem(ALERT_KEY) === 'on'; } catch { return false; }
  });
  const knownPending = useRef<Set<string> | null>(null);
  const alertsOnRef = useRef(alertsOn);
  alertsOnRef.current = alertsOn;

  useEffect(() => subscribeToOrders({ merchantId: merchant.id }, () => void query.reload(true)), [merchant.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(() => void query.reload(true), 10000, true, true);

  const pending = useMemo(() => (query.data?.active || []).filter((order) => order.status === 'pending'), [query.data]);

  // 偵測新訂單：響鈴 + 桌面通知 + 分頁標題
  useEffect(() => {
    if (!query.data) return;
    const ids = new Set(pending.map((order) => order.id));
    if (knownPending.current) {
      const fresh = pending.filter((order) => !knownPending.current!.has(order.id));
      if (fresh.length > 0) {
        showToast(`有 ${fresh.length} 張新訂單！`, 'info');
        if (alertsOnRef.current) {
          playNewOrderSound();
          showDesktopNotification('HealthGenie 新訂單', fresh.map((order) => `#${order.orderNumber.split('-')[1]} ${order.contactName} ${formatCurrency(order.total)}`).join('\n'));
        }
        setTab('pending');
      }
    }
    knownPending.current = ids;
  }, [pending, query.data]);

  // 還有未接的訂單時，每 30 秒再提醒一次
  useEffect(() => {
    const original = document.title.replace(/^\(\d+\) /, '');
    document.title = pending.length > 0 ? `(${pending.length}) ${original}` : original;
    if (pending.length === 0 || !alertsOn) return () => { document.title = original; };
    const timer = window.setInterval(playNewOrderSound, 30000);
    return () => {
      window.clearInterval(timer);
      document.title = original;
    };
  }, [pending.length, alertsOn]);

  const toggleAlerts = async () => {
    if (alertsOn) {
      setAlertsOn(false);
      try { localStorage.setItem(ALERT_KEY, 'off'); } catch { /* ignore */ }
      return;
    }
    const audio = await unlockAudio();
    await requestDesktopNotifications();
    setAlertsOn(true);
    try { localStorage.setItem(ALERT_KEY, 'on'); } catch { /* ignore */ }
    if (audio) playNewOrderSound();
    showToast(audio ? '已開啟新訂單提示音，請保持這個頁面開著' : '這個瀏覽器無法播放提示音，仍會顯示通知', audio ? 'success' : 'info');
  };

  // 重新整理頁面後，瀏覽器需要使用者點一下才允許播放聲音
  useEffect(() => {
    if (!alertsOn) return undefined;
    const unlock = () => { void unlockAudio(); };
    document.addEventListener('click', unlock, { once: true });
    return () => document.removeEventListener('click', unlock);
  }, [alertsOn]);

  const change = async (order: Order, status: OrderStatus, reason = '') => {
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status, reason);
      await query.reload(true);
      showToast({
        preparing: '已接單，開始製作',
        ready: order.fulfillment === 'pickup' ? '已通知顧客取餐' : '餐點完成',
        delivering: '已出發配送',
        completed: '訂單完成',
        rejected: '已拒絕訂單',
        cancelled: '訂單已取消',
        pending: '',
      }[status] || '已更新');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
      void query.reload(true);
    } finally {
      setBusyId('');
      setReasonFor(null);
    }
  };

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;

  const lists: Record<Tab, Order[]> = {
    pending,
    preparing: (query.data?.active || []).filter((order) => order.status === 'preparing'),
    ready: (query.data?.active || []).filter((order) => order.status === 'ready'),
    delivering: (query.data?.active || []).filter((order) => order.status === 'delivering'),
    done: query.data?.done || [],
  };
  const visibleTabs = TABS.filter((entry) => entry.key !== 'delivering' || merchant.deliveryEnabled || lists.delivering.length > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {visibleTabs.map((entry) => (
            <button key={entry.key} onClick={() => setTab(entry.key)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold ${tab === entry.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
              {entry.label}
              {lists[entry.key].length > 0 && <span className={`rounded-full px-1.5 text-xs ${entry.key === 'pending' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{lists[entry.key].length}</span>}
            </button>
          ))}
        </div>
        <button onClick={toggleAlerts} className={`${secondaryButton} ${alertsOn ? 'border-teal-500 bg-teal-50 text-teal-700' : ''}`}>
          {alertsOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}{alertsOn ? '新訂單提示音：開' : '開啟新訂單提示音'}
        </button>
      </div>
      {query.error && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">連線不穩定，正在重新嘗試…（{query.error}）</p>}
      {lists[tab].length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-12 w-12" />} title={tab === 'pending' ? '目前沒有新訂單' : '這裡沒有訂單'} text={tab === 'pending' ? '有新訂單時會自動出現，開啟提示音就不會漏單。' : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists[tab].map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              busy={busyId === order.id}
              onAction={(target, action) => (action.needsReason ? setReasonFor({ order: target, action }) : void change(target, action.status))}
            />
          ))}
        </div>
      )}
      {reasonFor && (
        <ReasonDialog
          title={reasonFor.action.label}
          description="顧客會在訂單頁看到這個原因。"
          presets={reasonFor.action.status === 'rejected' ? ['餐點已售完', '店內太忙，暫時無法接單', '超出外送範圍', '即將打烊'] : ['顧客要求取消', '食材不足', '顧客未取餐', '無法聯絡顧客']}
          confirmLabel={reasonFor.action.label}
          busy={busyId === reasonFor.order.id}
          onCancel={() => setReasonFor(null)}
          onConfirm={(reason) => void change(reasonFor.order, reasonFor.action.status, reason)}
        />
      )}
    </div>
  );
};
