import React, { useState } from 'react';
import { ImagePlus, Sparkles } from 'lucide-react';
import { estimateDishNutrition, uploadProductImage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ALLERGENS, NutritionKey, OptionGroup, Product, ProductInput } from '../../types';
import { resizeImage } from '../../utils/image';
import { errorMessage, showToast } from '../../utils/notifications';
import { OptionGroupEditor } from '../OptionGroupEditor';
import { Field, Modal, Spinner, inputClass, primaryButton, secondaryButton } from '../ui';

type NutritionForm = Record<NutritionKey, string>;

const NUTRITION_FIELDS: [NutritionKey, string][] = [
  ['calories', '熱量 kcal'],
  ['protein', '蛋白質 g'],
  ['fat', '脂肪 g'],
  ['carbs', '碳水 g'],
  ['fiber', '纖維 g'],
  ['sodium', '鈉 mg'],
  ['sugar', '糖 g'],
];

const toNutritionForm = (product?: Product): NutritionForm => Object.fromEntries(
  NUTRITION_FIELDS.map(([key]) => [key, product?.nutrition[key] === undefined || product?.nutrition[key] === null ? '' : String(product.nutrition[key])]),
) as NutritionForm;

const finite = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0);

const validateGroups = (groups: OptionGroup[]): Record<string, string> => {
  const errors: Record<string, string> = {};
  groups.forEach((group) => {
    const key = `group_${group.id}`;
    if (!group.name.trim()) errors[key] = '請輸入群組名稱';
    else if (group.options.length === 0) errors[key] = '每個群組至少需要一個選項';
    else if (group.options.some((option) => !option.name.trim())) errors[key] = '請填寫所有選項名稱';
    else if (group.options.some((option) => !Number.isInteger(Number(option.priceDelta)))) errors[key] = '加價請填整數';
    else if (group.minSelect < 0 || group.maxSelect < 1 || group.minSelect > group.maxSelect) errors[key] = '最少／最多選擇數設定不合理';
    else if (group.maxSelect > group.options.length) errors[key] = '最多選擇數不能超過選項數量';
  });
  return errors;
};

export const ProductForm: React.FC<{
  product?: Product;
  categories: string[];
  onClose: () => void;
  onSubmit: (input: ProductInput) => Promise<void>;
}> = ({ product, categories, onClose, onSubmit }) => {
  const { userId } = useAuth();
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || categories[0] || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [description, setDescription] = useState(product?.description || '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [nutrition, setNutrition] = useState<NutritionForm>(() => toNutritionForm(product));
  const [allergens, setAllergens] = useState<string[]>(product?.allergens || []);
  const [groups, setGroups] = useState<OptionGroup[]>(() => JSON.parse(JSON.stringify(product?.optionGroups || [])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'' | 'save' | 'upload' | 'ai'>('');

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setBusy('upload');
    try {
      const blob = await resizeImage(file, 1200);
      setImageBlob(blob);
      setImageUrl(await uploadProductImage(userId, blob));
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusy('');
    }
  };

  const estimate = async () => {
    if (!name.trim()) {
      setErrors({ name: '請先輸入餐點名稱' });
      return;
    }
    setBusy('ai');
    try {
      const result = await estimateDishNutrition(name.trim(), description.trim(), imageBlob || undefined);
      setNutrition({
        calories: String(Math.round(result.calories)),
        protein: String(Math.round(result.protein)),
        fat: String(Math.round(result.fat)),
        carbs: String(Math.round(result.carbs)),
        fiber: result.fiber === undefined ? nutrition.fiber : String(Math.round(result.fiber)),
        sodium: result.sodium === undefined ? nutrition.sodium : String(Math.round(result.sodium)),
        sugar: nutrition.sugar,
      });
      showToast('AI 已估算營養素，請依實際食譜確認後再儲存', 'info');
    } catch (caught) {
      showToast(errorMessage(caught, 'AI 估算失敗'), 'error');
    } finally {
      setBusy('');
    }
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = '請輸入餐點名稱';
    const priceValue = Number(price);
    if (price.trim() === '' || !Number.isInteger(priceValue) || priceValue < 0 || priceValue > 100000) next.price = '請輸入 0 以上的整數';
    NUTRITION_FIELDS.forEach(([key]) => {
      const value = nutrition[key];
      if (value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) next[`n_${key}`] = '需為 0 以上';
    });
    if (nutrition.calories.trim() === '' && NUTRITION_FIELDS.some(([key]) => key !== 'calories' && nutrition[key].trim() !== '')) {
      next.n_calories = '有填營養素時，熱量為必填';
    }
    Object.assign(next, validateGroups(groups));
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showToast('有欄位需要修正', 'error');
      return;
    }
    setBusy('save');
    try {
      await onSubmit({
        name: name.trim(),
        category: category.trim(),
        price: priceValue,
        description: description.trim(),
        imageUrl,
        nutrition: Object.fromEntries(NUTRITION_FIELDS.filter(([key]) => nutrition[key].trim() !== '').map(([key]) => [key, Number(nutrition[key])])),
        allergens,
        optionGroups: groups.map((group) => ({
          ...group,
          name: group.name.trim(),
          required: group.required === true,
          maxSelect: group.type === 'single' ? 1 : Math.max(1, Math.round(finite(group.maxSelect))),
          minSelect: Math.max(group.required ? 1 : 0, Math.round(finite(group.minSelect))),
          options: group.options.map((option) => ({
            ...option,
            name: option.name.trim(),
            priceDelta: Math.round(finite(option.priceDelta)),
            caloriesDelta: finite(option.caloriesDelta),
            proteinDelta: finite(option.proteinDelta),
            fatDelta: finite(option.fatDelta),
            carbsDelta: finite(option.carbsDelta),
            fiberDelta: finite(option.fiberDelta),
            sodiumDelta: finite(option.sodiumDelta),
            available: option.available !== false,
          })),
        })),
        available: product?.available ?? true,
        sortOrder: product?.sortOrder ?? 0,
      });
      onClose();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal
      title={product ? '編輯餐點' : '新增餐點'}
      size="lg"
      onClose={onClose}
      footer={(
        <div className="flex gap-3">
          <button onClick={onClose} className={`${secondaryButton} flex-1`}>取消</button>
          <button onClick={submit} disabled={busy !== ''} className={`${primaryButton} flex-1`}>{busy === 'save' && <Spinner className="h-4 w-4" />}{product ? '儲存' : '上架'}</button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {imageUrl && <img src={imageUrl} alt="餐點照片預覽" className="h-full w-full object-cover" />}
          </div>
          <div className="flex flex-col justify-center gap-2">
            <label className={`${secondaryButton} cursor-pointer`}>
              {busy === 'upload' ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}上傳餐點照片
              <input type="file" accept="image/*" className="sr-only" onChange={upload} disabled={busy !== ''} />
            </label>
            {imageUrl && <button type="button" onClick={() => { setImageUrl(''); setImageBlob(null); }} className="text-left text-sm text-slate-500 hover:underline">移除照片</button>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="餐點名稱" htmlFor="product-name" error={errors.name} className="sm:col-span-2">
            <input id="product-name" value={name} maxLength={50} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="價格 (NT$)" htmlFor="product-price" error={errors.price}>
            <input id="product-price" type="number" inputMode="numeric" min={0} value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="分類" htmlFor="product-category" hint="例如：便當、沙拉、飲料">
            <input id="product-category" list="product-categories" value={category} maxLength={30} onChange={(event) => setCategory(event.target.value)} className={inputClass} />
            <datalist id="product-categories">{categories.map((value) => <option key={value} value={value} />)}</datalist>
          </Field>
          <Field label="介紹" htmlFor="product-description" className="sm:col-span-2">
            <input id="product-description" value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} className={inputClass} placeholder="主要食材、做法、份量" />
          </Field>
        </div>

        <section className="rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-800">營養標示（一份）</h3>
              <p className="text-xs text-slate-500">健康平台的重點！填寫後顧客可以依熱量篩選。</p>
            </div>
            <button type="button" onClick={estimate} disabled={busy !== ''} className={`${secondaryButton} border-purple-200 text-purple-700`}>
              {busy === 'ai' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}AI 幫我估算
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUTRITION_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} htmlFor={`n-${key}`} error={errors[`n_${key}`]}>
                <input id={`n-${key}`} type="number" inputMode="decimal" min={0} value={nutrition[key]} onChange={(event) => setNutrition({ ...nutrition, [key]: event.target.value })} className={inputClass} />
              </Field>
            ))}
          </div>
        </section>

        <div>
          <p className="mb-2 text-sm font-bold text-slate-700">含有的過敏原</p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((allergen) => {
              const active = allergens.includes(allergen);
              return (
                <button key={allergen} type="button" onClick={() => setAllergens(active ? allergens.filter((value) => value !== allergen) : [...allergens, allergen])} className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-amber-400 bg-amber-50 font-bold text-amber-800' : 'border-slate-200 text-slate-600'}`}>
                  {allergen}
                </button>
              );
            })}
          </div>
        </div>

        <OptionGroupEditor groups={groups} onChange={setGroups} errors={errors} />
      </div>
    </Modal>
  );
};
