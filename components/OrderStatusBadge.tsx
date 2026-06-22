import React from 'react';
import { OrderStatus } from '../types';

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  let label = '';
  let colorClass = '';

  switch (status) {
    case OrderStatus.PENDING:
      label = '等待商家接單';
      colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
      break;
    case OrderStatus.PREPARING:
      label = '商家準備中';
      colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
      break;
    case OrderStatus.WAITING_PICKUP:
      label = '等待外送員取餐';
      colorClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
      break;
    case OrderStatus.DELIVERING:
      label = '配送中';
      colorClass = 'bg-teal-100 text-teal-700 border-teal-200';
      break;
    case OrderStatus.COMPLETED:
      label = '已送達';
      colorClass = 'bg-green-100 text-green-700 border-green-200';
      break;
    case OrderStatus.CANCELLED:
      label = '已取消';
      colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
      break;
    default:
      label = '未知狀態';
      colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
      {label}
    </span>
  );
};
