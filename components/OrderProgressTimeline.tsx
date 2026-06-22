import React from 'react';
import { OrderStatus } from '../types';
import { CheckCircle2, Circle } from 'lucide-react';

interface OrderProgressTimelineProps {
  status: OrderStatus;
}

const STEPS = [
  { key: OrderStatus.PENDING, label: '等待商家接單', description: '商家確認訂單中' },
  { key: OrderStatus.PREPARING, label: '商家準備中', description: '餐點正在努力製作' },
  { key: OrderStatus.WAITING_PICKUP, label: '等待外送員取餐', description: '外送員正在前往店家' },
  { key: OrderStatus.DELIVERING, label: '配送中', description: '餐點正在配送途中' },
  { key: OrderStatus.COMPLETED, label: '已送達', description: '祝您用餐愉快' }
];

export const OrderProgressTimeline: React.FC<OrderProgressTimelineProps> = ({ status }) => {
  if (status === OrderStatus.CANCELLED) return null;

  const currentStepIndex = STEPS.findIndex(s => s.key === status);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex flex-col gap-6">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex || status === OrderStatus.COMPLETED;
          const isCurrent = index === currentStepIndex && status !== OrderStatus.COMPLETED;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.key} className="flex gap-4 relative">
              {/* Timeline Line */}
              {index < STEPS.length - 1 && (
                <div 
                  className={`absolute left-3 top-8 bottom-[-24px] w-0.5 
                    ${isCompleted ? 'bg-teal-500' : 'bg-slate-200 border-dashed'}`}
                />
              )}
              
              {/* Icon */}
              <div className="relative z-10 shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-teal-500" />
                ) : isCurrent ? (
                  <div className="relative flex items-center justify-center w-6 h-6">
                    <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-teal-400"></span>
                    <span className="relative inline-flex w-3 h-3 rounded-full bg-teal-500"></span>
                  </div>
                ) : (
                  <Circle className="w-6 h-6 text-slate-300" />
                )}
              </div>

              {/* Text */}
              <div className={`pb-2 ${isPending ? 'opacity-50' : ''}`}>
                <h4 className={`font-bold ${isCurrent ? 'text-teal-700' : 'text-slate-800'}`}>
                  {step.label}
                </h4>
                <p className="text-sm text-slate-500 mt-1">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
