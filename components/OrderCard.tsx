import React from 'react';
import { Order, OrderStatus } from '../types';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Store, Clock, ChevronRight } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onClick: (orderId: string) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
  const isCanceled = order.status === OrderStatus.CANCELLED;
  const isCompleted = order.status === OrderStatus.COMPLETED;
  const isOngoing = !isCanceled && !isCompleted;
  
  const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  // Parse Date string into more readable format
  const orderDate = new Date(order.createdAt);
  const formattedDate = `${orderDate.getMonth() + 1}/${orderDate.getDate()} ${orderDate.getHours().toString().padStart(2, '0')}:${orderDate.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div 
      onClick={() => onClick(order.orderId)}
      className={`relative bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer hover:shadow-md transition-shadow
        ${isOngoing ? 'border-teal-200' : 'border-gray-200'}
        ${isCanceled ? 'opacity-70' : ''}`}
    >
      {isOngoing && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500" />}
      
      <div className="p-5 flex flex-col gap-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-1">
              <Store className="w-5 h-5 text-teal-600" />
              {order.storeName}
            </div>
            <p className="text-xs text-slate-400">訂單編號: {order.orderId} • {formattedDate}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Info */}
        <div className="flex items-center justify-between text-sm text-slate-600 mt-2">
          <div className="flex items-center gap-4">
            <span className="font-medium text-slate-800">{totalItemsCount} 件餐點</span>
            <span className="font-bold text-teal-600 text-lg">${order.totalAmount}</span>
          </div>
          
          <div className="flex items-center text-teal-600 font-medium">
            查看詳情 <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* Footer (Expected Arrival) */}
        {!isCanceled && (
          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4 text-slate-400" />
            預計送達: <span className="font-bold text-slate-700">{order.estimatedArrival}</span>
          </div>
        )}
      </div>
    </div>
  );
};
