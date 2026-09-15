import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { OrderStatus, StatusHistoryEntry } from '../types';

interface OrderProgressTimelineProps {
  status: OrderStatus;
  history?: StatusHistoryEntry[];
}

const STEPS = [
  { key: OrderStatus.PENDING, label: '等待商家接單', description: '商家正在確認訂單' },
  { key: OrderStatus.PREPARING, label: '製作中', description: '餐點正在製作' },
  { key: OrderStatus.WAITING_DELIVERY, label: '等待外送員', description: '餐點已完成，等待外送員' },
  { key: OrderStatus.DELIVERING, label: '配送中', description: '餐點正在配送途中' },
  { key: OrderStatus.COMPLETED, label: '已完成', description: '祝您用餐愉快' },
] as const;

export const OrderProgressTimeline: React.FC<OrderProgressTimelineProps> = ({ status, history = [] }) => {
  if (status === OrderStatus.CANCELLED || status === OrderStatus.REJECTED) return null;
  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.key === status));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex flex-col gap-6">
        {STEPS.map((step, index) => {
          const completed = index < currentIndex || status === OrderStatus.COMPLETED;
          const current = index === currentIndex && status !== OrderStatus.COMPLETED;
          const timestamp = history.find((entry) => entry.status === step.key)?.timestamp;
          return (
            <div key={step.key} className="flex gap-4 relative">
              {index < STEPS.length - 1 && (
                <div className={`absolute left-3 top-8 bottom-[-24px] w-0.5 ${completed ? 'bg-teal-500' : 'bg-slate-200'}`} />
              )}
              <div className="relative z-10 shrink-0">
                {completed ? (
                  <CheckCircle2 className="w-6 h-6 text-teal-500" />
                ) : current ? (
                  <div className="relative flex items-center justify-center w-6 h-6">
                    <span className="absolute w-full h-full rounded-full opacity-75 animate-ping bg-teal-400" />
                    <span className="relative w-3 h-3 rounded-full bg-teal-500" />
                  </div>
                ) : <Circle className="w-6 h-6 text-slate-300" />}
              </div>
              <div className={index > currentIndex ? 'opacity-50' : ''}>
                <h4 className={`font-bold ${current ? 'text-teal-700' : 'text-slate-800'}`}>{step.label}</h4>
                <p className="text-sm text-slate-500 mt-1">{step.description}</p>
                {timestamp && (
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(timestamp).toLocaleString('zh-TW', { hour12: false })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
