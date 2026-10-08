import React, { useState } from 'react';
import { Camera, PenLine, Sparkles } from 'lucide-react';
import { addFoodLog, analyzeFoodPhoto } from '../../lib/api';
import { notifyFoodLogsUpdated } from '../../lib/health';
import { FoodLog } from '../../types';
import { resizeImage } from '../../utils/image';
import { errorMessage, showToast } from '../../utils/notifications';
import { Field, Modal, Spinner, inputClass, primaryButton, secondaryButton } from '../ui';

interface FormState {
  name: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
}

const EMPTY: FormState = { name: '', calories: '', protein: '', fat: '', carbs: '' };
const optional = (value: string): number | null => (value.trim() === '' ? null : Number(value));

export const FoodLogModal: React.FC<{ onClose: () => void; onSaved: (log: FoodLog) => void }> = ({ onClose, onSaved }) => {
  const [mode, setMode] = useState<'manual' | 'photo'>('manual');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [source, setSource] = useState<FoodLog['source']>('manual');
  const [preview, setPreview] = useState('');
  const [advice, setAdvice] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAnalyzing(true);
    setAdvice('');
    try {
      const image = await resizeImage(file, 1024, 0.8);
      setPreview(URL.createObjectURL(image));
      const result = await analyzeFoodPhoto(image);
      setForm({
        name: result.name,
        calories: String(Math.round(result.calories)),
        protein: String(Math.round(result.protein)),
        fat: String(Math.round(result.fat)),
        carbs: String(Math.round(result.carbs)),
      });
      setAdvice(result.advice || '');
      setSource('photo');
      setMode('manual');
      showToast('AI 已估算完成，請確認數字後儲存', 'info');
    } catch (caught) {
      showToast(errorMessage(caught, 'AI 分析失敗，請改用手動輸入'), 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = '請輸入吃了什麼';
    const calories = Number(form.calories);
    if (form.calories.trim() === '' || !Number.isFinite(calories) || calories < 0 || calories > 10000) next.calories = '請輸入 0–10000 之間的熱量';
    (['protein', 'fat', 'carbs'] as const).forEach((key) => {
      const value = optional(form[key]);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1000)) next[key] = '請輸入 0–1000';
    });
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const log = await addFoodLog({
        name: form.name.trim().slice(0, 60),
        calories,
        protein: optional(form.protein),
        fat: optional(form.fat),
        carbs: optional(form.carbs),
        source,
        orderId: null,
      });
      notifyFoodLogsUpdated();
      showToast(`已記錄：${log.name}`);
      onSaved(log);
      onClose();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  const input = (key: keyof FormState, label: string, unit: string) => (
    <Field label={`${label}${unit ? `（${unit}）` : ''}`} htmlFor={`log-${key}`} error={errors[key]}>
      <input id={`log-${key}`} type="number" inputMode="decimal" min={0} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={inputClass} />
    </Field>
  );

  return (
    <Modal
      title="記錄飲食"
      onClose={onClose}
      footer={mode === 'manual' ? (
        <div className="flex gap-3">
          <button onClick={onClose} className={`${secondaryButton} flex-1`}>取消</button>
          <button onClick={save} disabled={saving} className={`${primaryButton} flex-1`}>{saving && <Spinner className="h-4 w-4" />}儲存</button>
        </div>
      ) : undefined}
    >
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setMode('manual')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold ${mode === 'manual' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}><PenLine className="h-4 w-4" />手動輸入</button>
        <button onClick={() => setMode('photo')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold ${mode === 'photo' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}><Camera className="h-4 w-4" />AI 拍照估算</button>
      </div>

      {mode === 'photo' ? (
        <div className="text-center">
          <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 p-8 ${analyzing ? 'pointer-events-none opacity-70' : 'hover:bg-teal-50'}`}>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} disabled={analyzing} />
            {analyzing ? <Spinner className="h-10 w-10 text-teal-600" /> : <Sparkles className="h-10 w-10 text-teal-600" />}
            <span className="font-bold text-teal-800">{analyzing ? 'AI 正在估算熱量…' : '拍一張或選一張餐點照片'}</span>
            <span className="text-xs text-slate-500">AI 估算僅供參考，儲存前可以自行修改數字</span>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {preview && <img src={preview} alt="餐點照片" className="h-40 w-full rounded-xl object-cover" />}
          {advice && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">💡 {advice}</p>}
          <Field label="吃了什麼" htmlFor="log-name" error={errors.name}>
            <input id="log-name" value={form.name} maxLength={60} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="例如：雞胸肉便當" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {input('calories', '熱量', 'kcal')}
            {input('protein', '蛋白質', 'g')}
            {input('fat', '脂肪', 'g')}
            {input('carbs', '碳水', 'g')}
          </div>
        </div>
      )}
    </Modal>
  );
};
