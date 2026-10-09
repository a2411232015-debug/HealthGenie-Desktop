import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { OpeningSlot } from '../../types';
import { slotsForDay, WEEKDAY_LABELS } from '../../utils/hours';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const OpeningHoursEditor: React.FC<{ value: OpeningSlot[]; onChange: (slots: OpeningSlot[]) => void }> = ({ value, onChange }) => {
  const replaceDay = (day: number, slots: OpeningSlot[]) =>
    onChange([...value.filter((slot) => slot.day !== day), ...slots].sort((a, b) => a.day - b.day || a.open.localeCompare(b.open)));

  const copyToAll = (day: number) => {
    const source = slotsForDay(value, day);
    onChange(DAY_ORDER.flatMap((target) => source.map((slot) => ({ ...slot, day: target }))));
  };

  return (
    <div className="space-y-2">
      {DAY_ORDER.map((day) => {
        const slots = slotsForDay(value, day);
        return (
          <div key={day} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-start">
            <div className="flex w-28 shrink-0 items-center gap-2 pt-1.5">
              <input
                id={`day-${day}`}
                type="checkbox"
                checked={slots.length > 0}
                onChange={(event) => replaceDay(day, event.target.checked ? [{ day, open: '11:00', close: '20:00' }] : [])}
                className="accent-teal-600"
              />
              <label htmlFor={`day-${day}`} className="text-sm font-bold text-slate-700">{WEEKDAY_LABELS[day]}</label>
            </div>
            {slots.length === 0 ? <p className="pt-1.5 text-sm text-slate-400">公休</p> : (
              <div className="flex-1 space-y-2">
                {slots.map((slot, index) => (
                  <div key={`${slot.open}-${index}`} className="flex flex-wrap items-center gap-2">
                    <input type="time" aria-label={`${WEEKDAY_LABELS[day]}開店時間`} value={slot.open} onChange={(event) => replaceDay(day, slots.map((item, i) => (i === index ? { ...item, open: event.target.value } : item)))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                    <span className="text-slate-400">到</span>
                    <input type="time" aria-label={`${WEEKDAY_LABELS[day]}打烊時間`} value={slot.close} onChange={(event) => replaceDay(day, slots.map((item, i) => (i === index ? { ...item, close: event.target.value } : item)))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                    {slot.close <= slot.open && <span className="text-xs text-amber-600">營業到隔天</span>}
                    <button type="button" onClick={() => replaceDay(day, slots.filter((_, i) => i !== index))} className="p-1.5 text-slate-400 hover:text-red-600" aria-label="刪除這個時段"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex gap-3">
                  {slots.length < 3 && (
                    <button type="button" onClick={() => replaceDay(day, [...slots, { day, open: '17:00', close: '20:00' }])} className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline"><Plus className="h-3.5 w-3.5" />加一個時段</button>
                  )}
                  <button type="button" onClick={() => copyToAll(day)} className="text-xs font-bold text-slate-500 hover:underline">套用到每一天</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
