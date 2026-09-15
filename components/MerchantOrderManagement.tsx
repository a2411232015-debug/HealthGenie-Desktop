import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  Store,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { getOrders, updateOrderStatus } from '../data/repository';
import { formatCurrency } from '../utils/pricing';
import { showToast } from '../utils/notifications';
import { OrderStatusBadge } from './OrderStatusBadge';

interface MerchantOrderManagementProps {
  merchantId?: string;
}

export const MerchantOrderManagement: React.FC<MerchantOrderManagementProps> = ({
  merchantId = 'merchant_self',
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');

  const loadOrders = () => setOrders(getOrders().filter((order) => order.merchantId === merchantId));

  useEffect(() => {
    loadOrders();
    window.addEventListener('orders_updated', loadOrders);
    return () => window.removeEventListener('orders_updated', loadOrders);
  }, [merchantId]);

  const changeStatus = (order: Order, status: OrderStatus, reason?: string) => {
    const result = updateOrderStatus(order.orderId, status, reason);
    if (!result.success) {
      showToast(result.message || '訂單狀態更新失敗', 'error');
      return;
    }
    const message = {
      [OrderStatus.PREPARING]: '訂單已接收，開始製作',
      [OrderStatus.WAITING_DELIVERY]: '製作完成，正在等待外送員',
      [OrderStatus.DELIVERING]: '已開始配送',
      [OrderStatus.COMPLETED]: '訂單已完成',
      [OrderStatus.REJECTED]: '訂單已拒絕',
      [OrderStatus.CANCELLED]: '訂單已取消',
      [OrderStatus.PENDING]: '訂單狀態已更新',
    }[status];
    showToast(message);
  };

  const rejectOrder = (order: Order) => {
    if (!window.confirm('確定要拒絕此訂單嗎？拒絕後無法恢復。')) return;
    changeStatus(order, OrderStatus.REJECTED, '商家暫時無法接單');
  };

  const filteredOrders = useMemo(() => orders
    .filter((order) => activeTab === 'ALL' || order.status === activeTab)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [orders, activeTab]);

  const tabs = [
    { id: 'ALL', label: '全部' },
    { id: OrderStatus.PENDING, label: '新訂單' },
    { id: OrderStatus.PREPARING, label: '製作中' },
    { id: OrderStatus.WAITING_DELIVERY, label: '等待外送員' },
    { id: OrderStatus.DELIVERING, label: '配送中' },
    { id: OrderStatus.COMPLETED, label: '已完成' },
    { id: OrderStatus.CANCELLED, label: '已取消' },
    { id: OrderStatus.REJECTED, label: '已拒絕' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-black text-slate-800">訂單管理</h2>
        <p className="text-slate-500 mt-1">依序更新狀態，顧客端會同步顯示</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as OrderStatus | 'ALL')}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm ${activeTab === tab.id ? 'bg-teal-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
          <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">目前沒有訂單</h3>
          <p className="text-slate-500 mt-2">顧客下單後會立即出現在這裡。</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">此分類無訂單</h3>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const terminal = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(order.status);
            const latestHistory = order.statusHistory[order.statusHistory.length - 1];
            return (
              <article key={order.orderId} className={`bg-white rounded-2xl border shadow-sm p-6 ${order.status === OrderStatus.PENDING ? 'border-teal-400 ring-1 ring-teal-300' : 'border-slate-200'} ${terminal ? 'opacity-80' : ''}`}>
                <div className="flex flex-col xl:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-slate-800">{order.orderId}</h3>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(order.createdAt).toLocaleString('zh-TW', { hour12: false })}
                        </p>
                      </div>
                      <p className="text-2xl font-black text-teal-600">{formatCurrency(order.totalAmount)}</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4 mt-5 text-sm">
                      <p className="flex gap-2"><MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {order.address}</p>
                      <p className="flex gap-2"><Phone className="w-4 h-4 text-slate-400 shrink-0" /> {order.storePhone}</p>
                      {order.note && <p className="md:col-span-2 bg-amber-50 text-amber-700 rounded-lg p-2">備註：{order.note}</p>}
                      {order.cancelReason && <p className="md:col-span-2 bg-red-50 text-red-700 rounded-lg p-2">原因：{order.cancelReason}</p>}
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                      最近更新：{new Date(latestHistory.timestamp).toLocaleString('zh-TW', { hour12: false })}
                    </p>
                  </div>

                  <div className="xl:w-[420px] border-t xl:border-t-0 xl:border-l border-slate-100 pt-5 xl:pt-0 xl:pl-6">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">餐點與價格明細</h4>
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-sm">
                          <div className="flex justify-between gap-3 font-bold text-slate-800">
                            <span>{item.itemName} × {item.quantity}</span>
                            <span>{formatCurrency(item.subtotal)}</span>
                          </div>
                          {item.selectedOptions.map((option) => (
                            <p key={option.optionId} className="text-xs text-slate-500 mt-1">
                              {option.groupName}：{option.name} {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : '+NT$0'}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>

                    {!terminal && (
                      <div className="pt-4 mt-4 border-t border-slate-100">
                        {order.status === OrderStatus.PENDING && (
                          <div className="flex gap-3">
                            <button onClick={() => rejectOrder(order)} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold border border-red-100">拒單</button>
                            <button onClick={() => changeStatus(order, OrderStatus.PREPARING)} className="flex-[2] py-3 bg-teal-500 text-white rounded-xl font-bold">接單</button>
                          </div>
                        )}
                        {order.status === OrderStatus.PREPARING && (
                          <button onClick={() => changeStatus(order, OrderStatus.WAITING_DELIVERY)} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold">完成製作</button>
                        )}
                        {order.status === OrderStatus.WAITING_DELIVERY && (
                          <button onClick={() => changeStatus(order, OrderStatus.DELIVERING)} className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold">開始配送</button>
                        )}
                        {order.status === OrderStatus.DELIVERING && (
                          <button onClick={() => changeStatus(order, OrderStatus.COMPLETED)} className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold">完成訂單</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
