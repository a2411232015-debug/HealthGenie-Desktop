import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { MOCK_ORDERS } from '../constants';
import { OrderCard } from './OrderCard';

interface OrderListPageProps {
  onOrderClick: (orderId: string) => void;
}

export const OrderListPage: React.FC<OrderListPageProps> = ({ onOrderClick }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'ongoing' | 'completed' | 'cancelled'>('all');

  const loadOrders = () => {
    const saved = localStorage.getItem('user_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          return;
        }
      } catch (e) {
        console.error('Failed to parse orders from localStorage', e);
      }
    }
    // Fallback
    setOrders(MOCK_ORDERS);
  };

  useEffect(() => {
    loadOrders();
    const handleUpdate = () => loadOrders();
    window.addEventListener('orders_updated', handleUpdate);
    return () => window.removeEventListener('orders_updated', handleUpdate);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      switch (activeTab) {
        case 'ongoing':
          return order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED;
        case 'completed':
          return order.status === OrderStatus.COMPLETED;
        case 'cancelled':
          return order.status === OrderStatus.CANCELLED;
        case 'all':
        default:
          return true;
      }
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeTab]);

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">我的訂單</h1>
        <p className="text-slate-500 mt-2 text-lg">追蹤你的健康餐點配送狀態</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 hide-scrollbar">
        {[
          { id: 'all', label: '全部' },
          { id: 'ongoing', label: '進行中' },
          { id: 'completed', label: '已完成' },
          { id: 'cancelled', label: '已取消' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all
              ${activeTab === tab.id 
                ? 'bg-teal-500 text-white shadow-md' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <OrderCard key={order.orderId} order={order} onClick={onOrderClick} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-bold text-slate-700">沒有符合的訂單</h3>
            <p className="text-slate-500 mt-1">去看看有什麼好吃的健康餐點吧！</p>
          </div>
        )}
      </div>
    </div>
  );
};
