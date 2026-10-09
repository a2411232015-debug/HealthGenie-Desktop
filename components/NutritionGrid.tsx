import React from 'react';
import { Nutrition } from '../types';
import { formatNumber } from '../utils/format';

const FIELDS: [keyof Nutrition, string, string][] = [
  ['calories', '熱量', 'kcal'],
  ['protein', '蛋白質', 'g'],
  ['fat', '脂肪', 'g'],
  ['carbs', '碳水', 'g'],
  ['fiber', '膳食纖維', 'g'],
  ['sodium', '鈉', 'mg'],
];

export const NutritionGrid: React.FC<{ nutrition: Partial<Nutrition> | null; title?: string; note?: string }> = ({ nutrition, title = '營養標示', note }) => (
  <section className="rounded-2xl bg-slate-50 p-4">
    <h3 className="text-sm font-bold text-slate-700">{title}</h3>
    {nutrition && nutrition.calories !== undefined && nutrition.calories !== null ? (
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        {FIELDS.map(([key, label, unit]) => (
          <div key={key}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-0.5 font-black text-teal-700">{nutrition[key] === undefined || nutrition[key] === null ? '—' : formatNumber(nutrition[key], unit)}</p>
          </div>
        ))}
      </div>
    ) : <p className="mt-2 text-sm text-slate-500">店家尚未提供營養資訊</p>}
    {note && <p className="mt-3 text-xs text-slate-400">{note}</p>}
  </section>
);
