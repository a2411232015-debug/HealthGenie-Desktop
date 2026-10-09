import React from 'react';
import { Fulfillment, OrderStatus } from '../types';

export const statusLabel = (status: OrderStatus, fulfillment: Fulfillment): string => ({
  pending: '等待店家接單',
  preparing: '製作中',
  ready: fulfillment === 'pickup' ? '可以取餐了' : '等待出餐配送',
  delivering: '配送中',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '店家無法接單',
}[status] || status);

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-orange-100 text-orange-700 border-orange-200',
  preparing: 'bg-blue-100 text-blue-700 border-blue-200',
  ready: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  delivering: 'bg-teal-100 text-teal-700 border-teal-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

export const isActiveStatus = (status: OrderStatus): boolean =>
  status === 'pending' || status === 'preparing' || status === 'ready' || status === 'delivering';

export const OrderStatusBadge: React.FC<{ status: OrderStatus; fulfillment: Fulfillment }> = ({ status, fulfillment }) => (
  <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
    {statusLabel(status, fulfillment)}
  </span>
);
