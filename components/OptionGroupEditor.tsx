import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { OptionGroup, ProductOption } from '../types';

interface OptionGroupEditorProps {
  groups: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
  errors: Record<string, string>;
}

const newOption = (): ProductOption => ({
  id: `option_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  priceDelta: 0,
  caloriesDelta: 0,
  proteinDelta: 0,
  fatDelta: 0,
  carbsDelta: 0,
  fiberDelta: 0,
  sodiumDelta: 0,
  available: true,
});

export const newOptionGroup = (): OptionGroup => ({
  id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  type: 'single',
  required: false,
  minSelect: 0,
  maxSelect: 1,
  options: [newOption()],
});

export const OptionGroupEditor: React.FC<OptionGroupEditorProps> = ({ groups, onChange, errors }) => {
  const updateGroup = (index: number, patch: Partial<OptionGroup>) => {
    const next = [...groups];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const updateOption = (groupIndex: number, optionIndex: number, patch: Partial<ProductOption>) => {
    const next = [...groups];
    const options = [...next[groupIndex].options];
    options[optionIndex] = { ...options[optionIndex], ...patch };
    next[groupIndex] = { ...next[groupIndex], options };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-bold text-slate-800">餐點規格與加料</h4>
          <p className="text-xs text-slate-400 mt-1">可設定飯量、口味、加料及營養增量</p>
        </div>
        <button type="button" onClick={() => onChange([...groups, newOptionGroup()])} className="px-3 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-bold flex items-center gap-1">
          <Plus className="w-4 h-4" /> 新增群組
        </button>
      </div>

      {groups.length === 0 && <p className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl p-5 text-center">尚未建立規格群組</p>}
      {groups.map((group, groupIndex) => (
        <section key={group.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-500">群組名稱</label>
              <input value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} placeholder="例如：飯量" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">選擇方式</label>
              <select value={group.type} onChange={(event) => updateGroup(groupIndex, { type: event.target.value as OptionGroup['type'], maxSelect: event.target.value === 'single' ? 1 : Math.max(1, group.maxSelect) })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="single">單選</option>
                <option value="multiple">複選</option>
              </select>
            </div>
            <div className="flex items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-bold pb-2">
                <input type="checkbox" checked={group.required} onChange={(event) => updateGroup(groupIndex, { required: event.target.checked, minSelect: event.target.checked ? Math.max(1, group.minSelect) : group.minSelect })} className="accent-teal-500" />
                必選
              </label>
              <button type="button" onClick={() => window.confirm('確定刪除此規格群組嗎？') && onChange(groups.filter((_, index) => index !== groupIndex))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <label className="text-xs font-bold text-slate-500">最少選擇
              <input type="number" min="0" value={group.minSelect} onChange={(event) => updateGroup(groupIndex, { minSelect: Number(event.target.value) })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 bg-white" />
            </label>
            <label className="text-xs font-bold text-slate-500">最多選擇
              <input type="number" min="1" value={group.maxSelect} disabled={group.type === 'single'} onChange={(event) => updateGroup(groupIndex, { maxSelect: Number(event.target.value) })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 bg-white disabled:bg-slate-100" />
            </label>
          </div>

          <div className="space-y-3">
            {group.options.map((option, optionIndex) => (
              <div key={option.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500">選項名稱</label>
                    <input value={option.name} onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })} placeholder="例如：正常飯量" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold mt-7">
                    <input type="checkbox" checked={option.available} onChange={(event) => updateOption(groupIndex, optionIndex, { available: event.target.checked })} className="accent-teal-500" /> 供應
                  </label>
                  <button type="button" onClick={() => updateGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })} className="p-2 mt-5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  {[
                    ['priceDelta', '加價 NT$'],
                    ['caloriesDelta', '熱量 kcal'],
                    ['proteinDelta', '蛋白質 g'],
                    ['fatDelta', '脂肪 g'],
                    ['carbsDelta', '碳水 g'],
                    ['fiberDelta', '纖維 g'],
                    ['sodiumDelta', '鈉 mg'],
                  ].map(([field, label]) => (
                    <label key={field} className="text-[11px] font-bold text-slate-500">{label}
                      <input type="number" value={option[field as keyof ProductOption] as number} onChange={(event) => updateOption(groupIndex, optionIndex, { [field]: Number(event.target.value) })} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => updateGroup(groupIndex, { options: [...group.options, newOption()] })} className="w-full py-2 border border-dashed border-teal-300 text-teal-700 rounded-lg text-sm font-bold">＋ 新增選項</button>
          </div>
          {errors[`group_${group.id}`] && <p className="text-red-500 text-xs">{errors[`group_${group.id}`]}</p>}
        </section>
      ))}
    </div>
  );
};
