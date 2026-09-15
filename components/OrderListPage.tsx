import React, { useEffect, useMemo, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders } from '../data/repository';
import { OrderCard } from './OrderCard';

interface OrderListPageProps {
  onOrderClick: (orderId: string) => void;
}

export const OrderListPage: React.FC<OrderListPageProps> = ({ onOrderClick }) => {
  const [orders, setOrders] = useState<Order[]>(() => getOrders());
  const [activeTab, setActiveTab] = useState<'all' | 'ongoing' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    const loadOrders = () => setOrders(getOrders());
    window.addEventListener('orders_updated', loadOrders);
    return () => window.removeEventListener('orders_updated', loadOrders);
  }, []);

  const filteredOrders = useMemo(() => orders
    .filter((order) => {
      if (activeTab === 'ongoing') {
        return ![OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(order.status);
      }
      if (activeTab === 'completed') return order.status === OrderStatus.COMPLETED;
      if (activeTab === 'cancelled') {
        return order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [orders, activeTab]);

  return (
    <div className="w-full max-w-[1000px] mx-auto animate-in fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">我的訂單</h1>
        <p className="text-slate-500 mt-2">顧客端與商家端共用同一份訂單狀態</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {[
          { id: 'all', label: '全部' },
          { id: 'ongoing', label: '進行中' },
          { id: 'completed', label: '已完成' },
          { id: 'cancelled', label: '已取消／拒單' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm ${activeTab === tab.id ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOrders.length > 0 ? filteredOrders.map((order) => (
          <OrderCard key={order.orderId} order={order} onClick={onOrderClick} />
        )) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-slate-100">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-bold text-slate-700">沒有符合的訂單</h3>
          </div>
        )}
      </div>
    </div>
  );
};
