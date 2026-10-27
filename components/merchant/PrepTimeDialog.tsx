import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { Order } from '../../types';
import { slotLabel } from '../../utils/hours';
import { Modal, Spinner, primaryButton, secondaryButton } from '../ui';

const PRESETS = [10, 15, 20, 30, 45, 60];

/** 店家接單時設定這張訂單的製作時間，顧客會看到預計完成／送達時間 */
export const PrepTimeDialog: React.FC<{
  order: Order;
  defaultMinutes: number;
  busy?: boolean;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}> = ({ order, defaultMinutes, busy, onConfirm, onCancel }) => {
  const [minutes, setMinutes] = useState(() => Math.min(180, Math.max(5, defaultMinutes || 20)));
  const options = Array.from(new Set([...PRESETS, minutes])).sort((a, b) => a - b);
  const readyAt = new Date(Date.now() + minutes * 60000);
  return (
    <Modal
      title={`接單 #${order.orderNumber.split('-')[1] || order.orderNumber}`}
      onClose={onCancel}
      footer={(
        <div className="flex gap-3">
          <button onClick={onCancel} className={`${secondaryButton} flex-1`}>取消</button>
          <button onClick={() => onConfirm(minutes)} disabled={busy} className={`${primaryButton} flex-1`}>{busy && <Spinner className="h-4 w-4" />}接單，約 {minutes} 分鐘完成</button>
        </div>
      )}
    >
      <p className="flex items-center gap-2 text-sm font-bold text-slate-700"><Clock className="h-4 w-4 text-teal-600" />這張訂單需要多久做好？</p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="製作時間">
        {options.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={minutes === value} onClick={() => setMinutes(value)} className={`rounded-xl border-2 px-3 py-3 text-sm font-bold ${minutes === value ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-100 text-slate-600'}`}>
            {value} 分鐘
          </button>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {order.scheduledFor
          ? `預約訂單：顧客預約 ${slotLabel(new Date(order.scheduledFor))}，會以預約時間為準。`
          : `顧客會看到：預計 ${readyAt.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })} 完成${order.fulfillment === 'delivery' ? '，再加上車程估算送達時間' : '，可以來取餐'}。`}
      </p>
    </Modal>
  );
};
