import React from 'react';
import { ChevronRight, Clock, Store } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { formatCurrency } from '../utils/pricing';
import { OrderStatusBadge } from './OrderStatusBadge';

interface OrderCardProps {
  order: Order;
  onClick: (orderId: string) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
  const terminal = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(order.status);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const date = new Date(order.createdAt);
  return (
    <button
      onClick={() => onClick(order.orderId)}
      className={`text-left relative bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow p-5 ${terminal ? 'border-slate-200' : 'border-teal-200'}`}
    >
      {!terminal && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500" />}
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-slate-800 font-bold text-lg">
            <Store className="w-5 h-5 text-teal-600" /> {order.storeName}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {order.orderId} · {Number.isFinite(date.getTime()) ? date.toLocaleString('zh-TW', { hour12: false }) : '時間未提供'}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{itemCount} 件餐點</span>
          <span className="font-black text-teal-600 text-lg">{formatCurrency(order.totalAmount)}</span>
        </div>
        <span className="flex items-center text-teal-600 text-sm font-bold">查看詳情 <ChevronRight className="w-4 h-4" /></span>
      </div>
      {!terminal && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
          <Clock className="w-4 h-4" /> {order.estimatedArrival}
        </div>
      )}
    </button>
  );
};
