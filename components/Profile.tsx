import React, { useMemo, useState } from 'react';
import { ActivityLevel, Gender, UserProfile, WeightData } from '../types';
import { ICONS } from '../constants';
import { showToast } from '../utils/notifications';
import { WeightChart } from './WeightChart';

interface ProfileProps {
  data: UserProfile;
  weightHistory: WeightData[];
  onSave: (data: UserProfile) => void;
  onAdminAccess: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ data, weightHistory, onSave, onAdminAccess }) => {
  const [form, setForm] = useState<UserProfile>(data);
  const [logWeight, setLogWeight] = useState(data.weight);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('7d');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const bmi = useMemo(() => {
    if (form.height < 100 || form.weight < 20) return null;
    return Number((form.weight / Math.pow(form.height / 100, 2)).toFixed(1));
  }, [form.height, form.weight]);

  const filteredHistory = useMemo(() => {
    if (timeframe === '7d') return weightHistory.slice(-7);
    if (timeframe === '30d') return weightHistory.slice(-30);
    if (timeframe === '90d') return weightHistory.slice(-90);
    return weightHistory;
  }, [timeframe, weightHistory]);

  const validate = (candidate: UserProfile): boolean => {
    const next: Record<string, string> = {};
    if (candidate.age < 1 || candidate.age > 120) next.age = '年齡須介於 1 至 120';
    if (candidate.height < 100 || candidate.height > 250) next.height = '身高須介於 100 至 250 cm';
    if (candidate.weight < 20 || candidate.weight > 300) next.weight = '體重須介於 20 至 300 kg';
    if (candidate.targetWeight !== undefined && (candidate.targetWeight < 20 || candidate.targetWeight > 300)) {
      next.targetWeight = '目標體重須介於 20 至 300 kg';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate(form)) return;
    onSave(form);
  };

  const saveWeight = () => {
    const next = { ...form, weight: logWeight };
    if (!validate(next)) return;
    setForm(next);
    onSave(next);
    showToast('體重紀錄已儲存');
  };

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="bg-teal-600 p-8 text-white text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center text-4xl">👤</div>
          <h2 className="text-2xl font-bold mt-4">個人生理數據</h2>
          <p className="text-teal-100 mt-2">資料會保存在此裝置並用於自動計算健康目標</p>
        </div>

        <section className="m-6 p-5 border border-slate-100 rounded-2xl text-center">
          <h3 className="font-bold text-slate-700">今日體重紀錄</h3>
          <div className="flex items-center justify-center gap-3 mt-4">
            <input type="number" min="20" max="300" step="0.1" value={logWeight} onChange={(event) => setLogWeight(Number(event.target.value))} className="w-32 text-center text-xl font-bold p-2 bg-slate-50 border border-slate-200 rounded-xl" />
            <span className="text-slate-500 font-bold">kg</span>
            <button onClick={saveWeight} className="px-5 py-2.5 bg-teal-500 text-white rounded-xl font-bold">儲存</button>
          </div>
          {errors.weight && <p className="text-red-500 text-xs mt-2">{errors.weight}</p>}
        </section>

        <section className="p-6 bg-slate-50/60 border-y border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">{ICONS.Activity} 體重趨勢</h3>
            <div className="bg-slate-100 p-1 rounded-lg">
              {[
                ['7天', '7d'],
                ['30天', '30d'],
                ['90天', '90d'],
                ['全部', 'all'],
              ].map(([label, value]) => (
                <button key={value} onClick={() => setTimeframe(value as typeof timeframe)} className={`px-3 py-1 rounded-md text-xs font-bold ${timeframe === value ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500'}`}>{label}</button>
              ))}
            </div>
          </div>
          {filteredHistory.length > 1 ? (
            <WeightChart data={filteredHistory} targetWeight={form.targetWeight || 65} />
          ) : <p className="text-center text-slate-400 py-12">需要至少兩筆體重紀錄才能顯示趨勢</p>}
        </section>

        <form onSubmit={submit} className="p-8 space-y-5">
          <div>
            <label className="text-sm font-bold text-slate-700">生理性別</label>
            <div className="flex gap-3 mt-2">
              {Object.values(Gender).map((gender) => (
                <button type="button" key={gender} onClick={() => setForm({ ...form, gender })} className={`flex-1 py-3 rounded-xl border-2 font-bold ${form.gender === gender ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-100 text-slate-500'}`}>{gender}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-age" className="text-sm font-bold text-slate-700">年齡</label>
              <input id="profile-age" type="number" min="1" max="120" value={form.age} onChange={(event) => setForm({ ...form, age: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
            </div>
            <div>
              <label htmlFor="profile-height" className="text-sm font-bold text-slate-700">身高 (cm)</label>
              <input id="profile-height" type="number" min="100" max="250" value={form.height} onChange={(event) => setForm({ ...form, height: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              {errors.height && <p className="text-red-500 text-xs mt-1">{errors.height}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-weight" className="text-sm font-bold text-slate-700">體重 (kg)</label>
              <input id="profile-weight" type="number" min="20" max="300" step="0.1" value={form.weight} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight}</p>}
            </div>
            <div>
              <label htmlFor="profile-target-weight" className="text-sm font-bold text-slate-700">目標體重 (kg)</label>
              <input id="profile-target-weight" type="number" min="20" max="300" step="0.1" value={form.targetWeight || ''} onChange={(event) => setForm({ ...form, targetWeight: Number(event.target.value) })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              {errors.targetWeight && <p className="text-red-500 text-xs mt-1">{errors.targetWeight}</p>}
            </div>
          </div>

          <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl flex justify-between items-center">
            <div><p className="text-sm font-bold text-slate-600">BMI 數值</p><p className="text-3xl font-black text-slate-800 mt-1">{bmi ?? '尚未提供'}</p></div>
            <span className="text-teal-700 font-bold">{bmi === null ? '請輸入有效資料' : bmi < 18.5 ? '體重過輕' : bmi < 24 ? '健康體位' : bmi < 27 ? '體重過重' : '需留意體重'}</span>
          </div>

          <div>
            <label htmlFor="profile-activity" className="text-sm font-bold text-slate-700">日常活動量</label>
            <select id="profile-activity" value={form.activityLevel} onChange={(event) => setForm({ ...form, activityLevel: event.target.value as ActivityLevel })} className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {Object.values(ActivityLevel).map((level) => <option key={level}>{level}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold text-lg">儲存並自動計算</button>
        </form>
      </div>
      <button onClick={onAdminAccess} className="mt-8 mx-auto flex items-center gap-2 text-xs text-slate-400 hover:text-teal-600">{ICONS.Admin} 我是合作商家 (Merchant Login)</button>
    </div>
  );
};
