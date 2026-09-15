import React from 'react';
import { OrderStatus } from '../types';

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  [OrderStatus.PENDING]: { label: '等待商家接單', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  [OrderStatus.PREPARING]: { label: '製作中', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  [OrderStatus.WAITING_DELIVERY]: { label: '等待外送員', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  [OrderStatus.DELIVERING]: { label: '配送中', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  [OrderStatus.COMPLETED]: { label: '已完成', className: 'bg-green-100 text-green-700 border-green-200' },
  [OrderStatus.CANCELLED]: { label: '已取消', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  [OrderStatus.REJECTED]: { label: '商家拒單', className: 'bg-red-100 text-red-700 border-red-200' },
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META[OrderStatus.PENDING];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${meta.className}`}>
      {meta.label}
    </span>
  );
};
