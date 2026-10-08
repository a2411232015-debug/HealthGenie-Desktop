import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Fulfillment, OrderStatus, StatusHistoryEntry } from '../types';
import { formatTime } from '../utils/format';

interface Step {
  key: OrderStatus;
  label: string;
  description: string;
}

const stepsFor = (fulfillment: Fulfillment): Step[] => [
  { key: 'pending', label: '已送出訂單', description: '等待店家確認' },
  { key: 'preparing', label: '店家製作中', description: '店家已接單，正在準備餐點' },
  fulfillment === 'pickup'
    ? { key: 'ready', label: '可以取餐', description: '餐點已完成，請到店取餐並付款' }
    : { key: 'ready', label: '餐點完成', description: '準備出發配送' },
  ...(fulfillment === 'delivery' ? [{ key: 'delivering' as OrderStatus, label: '配送中', description: '餐點正在路上，送達時付款' }] : []),
  { key: 'completed', label: '已完成', description: '祝你用餐愉快' },
];

export const OrderProgressTimeline: React.FC<{ status: OrderStatus; fulfillment: Fulfillment; history: StatusHistoryEntry[] }> = ({ status, fulfillment, history }) => {
  if (status === 'cancelled' || status === 'rejected') return null;
  const steps = stepsFor(fulfillment);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === status));
  return (
    <ol className="space-y-5">
      {steps.map((step, index) => {
        const done = index < currentIndex || status === 'completed';
        const current = index === currentIndex && status !== 'completed';
        const at = history.find((entry) => entry.status === step.key)?.at;
        return (
          <li key={step.key} className="relative flex gap-4">
            {index < steps.length - 1 && <span className={`absolute left-3 top-7 h-[calc(100%-4px)] w-0.5 ${done ? 'bg-teal-500' : 'bg-slate-200'}`} />}
            <span className="relative z-10 shrink-0">
              {done ? <CheckCircle2 className="h-6 w-6 text-teal-500" /> : current ? (
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                  <span className="relative h-3 w-3 rounded-full bg-teal-500" />
                </span>
              ) : <Circle className="h-6 w-6 text-slate-300" />}
            </span>
            <div className={index > currentIndex ? 'opacity-50' : ''}>
              <p className={`font-bold ${current ? 'text-teal-700' : 'text-slate-800'}`}>{step.label}</p>
              <p className="text-sm text-slate-500">{step.description}</p>
              {at && <p className="mt-0.5 text-xs text-slate-400">{formatTime(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
