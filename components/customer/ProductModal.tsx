import React, { useMemo, useState } from 'react';
import { AlertTriangle, Info, Minus, Plus, ShoppingBag } from 'lucide-react';
import { addToCart, buildCartItem } from '../../lib/cart';
import { useTodayIntake } from '../../lib/health';
import { Merchant, Product } from '../../types';
import { generateHealthWarnings } from '../../utils/health';
import { showToast } from '../../utils/notifications';
import { computeLine, formatCurrency, groupLimits } from '../../utils/pricing';
import { NutritionGrid } from '../NutritionGrid';
import { ConfirmDialog, Modal, inputClass, primaryButton } from '../ui';
import { storeState, STORE_STATE_LABEL } from './storeStatus';

type Selections = Record<string, string[]>;

const initialSelections = (product: Product): Selections => Object.fromEntries(
  product.optionGroups.map((group) => {
    const first = group.options.find((option) => option.available !== false);
    return [group.id, group.type === 'single' && group.required && first ? [first.id] : []];
  }),
);

export const ProductModal: React.FC<{ product: Product; merchant: Merchant; onClose: () => void }> = ({ product, merchant, onClose }) => {
  const [selections, setSelections] = useState<Selections>(() => initialSelections(product));
  const [quantity, setQuantity] = useState(1);
  const [remark, setRemark] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [askReplace, setAskReplace] = useState(false);
  const intake = useTodayIntake();
  const state = storeState(merchant);

  const selectedIds = useMemo(() => Object.values(selections).flat(), [selections]);
  const line = useMemo(() => computeLine(product, selectedIds), [product, selectedIds]);
  const warnings = generateHealthWarnings(line.unitNutrition, intake.targets?.dailyCalories ?? null, intake.consumedCalories);

  const toggle = (groupId: string, optionId: string) => {
    const group = product.optionGroups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    setSelections((current) => {
      const selected = current[groupId] || [];
      if (group.type === 'single') return { ...current, [groupId]: selected.includes(optionId) && !group.required ? [] : [optionId] };
      if (selected.includes(optionId)) return { ...current, [groupId]: selected.filter((id) => id !== optionId) };
      const { max } = groupLimits(group);
      if (selected.length >= max) {
        showToast(`${group.name}最多選 ${max} 項`, 'info');
        return current;
      }
      return { ...current, [groupId]: [...selected, optionId] };
    });
  };

  const add = (replace = false) => {
    if (Object.keys(line.errors).length > 0) {
      setShowErrors(true);
      return;
    }
    const item = buildCartItem(product, selectedIds, quantity, remark);
    if (!addToCart(merchant, item, replace)) {
      setAskReplace(true);
      return;
    }
    showToast(replace ? '已清空原本的購物車並加入餐點' : '已加入購物車');
    onClose();
  };

  return (
    <>
      <Modal
        title={product.name}
        onClose={onClose}
        footer={(
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="p-3 text-slate-500" aria-label="減少數量"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-black" aria-live="polite">{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => Math.min(50, value + 1))} className="p-3 text-slate-500" aria-label="增加數量"><Plus className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => add()} disabled={state !== 'open' || !product.available} className={`${primaryButton} flex-1 py-3`}>
              <ShoppingBag className="h-4 w-4" />
              {!product.available ? '已售完' : state !== 'open' ? `${STORE_STATE_LABEL[state]}，暫不接單` : `加入購物車 · ${formatCurrency(line.unitPrice * quantity)}`}
            </button>
          </div>
        )}
      >
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="-mx-5 -mt-4 mb-4 h-52 w-[calc(100%+2.5rem)] max-w-none object-cover" />}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{merchant.name}</p>
            {product.description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{product.description}</p>}
          </div>
          <p className="shrink-0 text-2xl font-black text-teal-700">{formatCurrency(line.unitPrice)}</p>
        </div>
        {product.allergens.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" /> 含過敏原：{product.allergens.join('、')}
          </p>
        )}

        <div className="mt-4">
          <NutritionGrid nutrition={line.unitNutrition} title="營養標示（依目前選擇計算）" />
        </div>

        <div className="mt-5 space-y-5">
          {product.optionGroups.map((group) => {
            const { min, max } = groupLimits(group);
            return (
              <fieldset key={group.id}>
                <legend className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  {group.name}
                  <span className="text-xs font-medium text-slate-400">
                    {min > 0 ? '必選' : '選填'} · {group.type === 'single' ? '單選' : `最多 ${max} 項`}
                  </span>
                </legend>
                <div className="mt-2 space-y-2">
                  {group.options.map((option) => {
                    const checked = (selections[group.id] || []).includes(option.id);
                    const disabled = option.available === false;
                    return (
                      <label key={option.id} className={`flex items-center gap-3 rounded-xl border p-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                        <input
                          type={group.type === 'single' ? 'radio' : 'checkbox'}
                          name={`group-${group.id}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(group.id, option.id)}
                          className="accent-teal-600"
                        />
                        <span className="flex-1 text-sm font-medium">{option.name}{disabled && '（已停售）'}</span>
                        <span className="text-sm font-bold text-slate-500">
                          {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : option.priceDelta < 0 ? `-${formatCurrency(-option.priceDelta)}` : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {showErrors && line.errors[group.id] && <p className="mt-1.5 text-xs font-medium text-red-600">{line.errors[group.id]}</p>}
              </fieldset>
            );
          })}
          <div>
            <label htmlFor="item-remark" className="text-sm font-bold text-slate-800">給店家的備註</label>
            <input id="item-remark" value={remark} maxLength={100} onChange={(event) => setRemark(event.target.value)} className={`${inputClass} mt-2`} placeholder="例如：不要蔥、醬料分開" />
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-5 space-y-2">
            {warnings.map((warning) => (
              <p key={warning.text} className={`flex gap-2 rounded-xl border p-3 text-sm ${warning.level === 'danger' ? 'border-red-100 bg-red-50 text-red-700' : warning.level === 'warning' ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-teal-100 bg-teal-50 text-teal-800'}`}>
                {warning.level === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                {warning.text}
              </p>
            ))}
          </div>
        )}
      </Modal>
      {askReplace && (
        <ConfirmDialog
          title="購物車裡有別家店的餐點"
          message="一張訂單只能點同一間店。要清空目前的購物車，改點這間店嗎？"
          confirmLabel="清空並加入"
          danger
          onCancel={() => setAskReplace(false)}
          onConfirm={() => { setAskReplace(false); add(true); }}
        />
      )}
    </>
  );
};
