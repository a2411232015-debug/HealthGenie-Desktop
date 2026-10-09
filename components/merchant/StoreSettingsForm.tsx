import React, { useState } from 'react';
import { ImagePlus, LocateFixed } from 'lucide-react';
import { uploadProductImage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Merchant, MerchantInput } from '../../types';
import { defaultOpeningHours, validateOpeningHours } from '../../utils/hours';
import { requestLocation } from '../../utils/geo';
import { isValidPhone } from '../../utils/format';
import { resizeImage } from '../../utils/image';
import { errorMessage, showToast } from '../../utils/notifications';
import { Field, Spinner, card, inputClass, primaryButton, secondaryButton } from '../ui';
import { OpeningHoursEditor } from './OpeningHoursEditor';

export const emptyMerchantInput = (): MerchantInput => ({
  name: '',
  description: '',
  phone: '',
  address: '',
  lat: null,
  lng: null,
  coverImageUrl: '',
  openingHours: defaultOpeningHours(),
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFee: 30,
  serviceFee: 0,
  discount: 0,
  minOrderAmount: 0,
  prepMinutes: 20,
  acceptingOrders: true,
});

export const merchantToInput = (merchant: Merchant): MerchantInput => ({
  name: merchant.name,
  description: merchant.description,
  phone: merchant.phone,
  address: merchant.address,
  lat: merchant.lat,
  lng: merchant.lng,
  coverImageUrl: merchant.coverImageUrl,
  openingHours: merchant.openingHours,
  pickupEnabled: merchant.pickupEnabled,
  deliveryEnabled: merchant.deliveryEnabled,
  deliveryFee: merchant.deliveryFee,
  serviceFee: merchant.serviceFee,
  discount: merchant.discount,
  minOrderAmount: merchant.minOrderAmount,
  prepMinutes: merchant.prepMinutes,
  acceptingOrders: merchant.acceptingOrders,
});

const validate = (input: MerchantInput): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2 || input.name.trim().length > 50) errors.name = '店名需要 2–50 個字';
  if (!isValidPhone(input.phone)) errors.phone = '請輸入正確的電話';
  if (input.address.trim().length < 5) errors.address = '請輸入完整地址';
  if (input.description.length > 300) errors.description = '最多 300 字';
  if (!input.pickupEnabled && !input.deliveryEnabled) errors.fulfillment = '至少要提供自取或外送其中一種';
  const hoursError = validateOpeningHours(input.openingHours);
  if (hoursError) errors.openingHours = hoursError;
  if (input.openingHours.length === 0) errors.openingHours = '請至少設定一天的營業時間';
  ([['deliveryFee', 1000], ['serviceFee', 1000], ['discount', 1000], ['minOrderAmount', 100000]] as const).forEach(([key, max]) => {
    const value = input[key];
    if (!Number.isInteger(value) || value < 0 || value > max) errors[key] = `請輸入 0–${max} 的整數`;
  });
  if (!Number.isInteger(input.prepMinutes) || input.prepMinutes < 5 || input.prepMinutes > 180) errors.prepMinutes = '請輸入 5–180 分鐘';
  return errors;
};

export const StoreSettingsForm: React.FC<{
  initial: MerchantInput;
  submitLabel: string;
  onSubmit: (input: MerchantInput) => Promise<void>;
}> = ({ initial, submitLabel, onSubmit }) => {
  const { userId } = useAuth();
  const [input, setInput] = useState<MerchantInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof MerchantInput>(key: K, value: MerchantInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const numberField = (key: 'deliveryFee' | 'serviceFee' | 'discount' | 'minOrderAmount' | 'prepMinutes', label: string, hint?: string) => (
    <Field label={label} htmlFor={`store-${key}`} error={errors[key]} hint={hint}>
      <input id={`store-${key}`} type="number" inputMode="numeric" min={0} value={Number.isFinite(input[key]) ? input[key] : ''} onChange={(event) => set(key, event.target.value === '' ? Number.NaN : Number(event.target.value))} className={inputClass} />
    </Field>
  );

  const fillLocation = async () => {
    try {
      const coords = await requestLocation();
      setInput((current) => ({ ...current, lat: Number(coords.lat.toFixed(6)), lng: Number(coords.lng.toFixed(6)) }));
      showToast('已填入目前位置，請確認你現在就在店裡');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    }
  };

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setUploading(true);
    try {
      set('coverImageUrl', await uploadProductImage(userId, await resizeImage(file, 1600)));
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = validate(input);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showToast('有欄位需要修正', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...input, phone: input.phone.replace(/[\s-]/g, '') });
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className={`${card} space-y-4 p-5`}>
        <h2 className="font-black text-slate-900">基本資料</h2>
        <Field label="店名" htmlFor="store-name" error={errors.name}>
          <input id="store-name" value={input.name} maxLength={50} onChange={(event) => set('name', event.target.value)} className={inputClass} />
        </Field>
        <Field label="店家介紹" htmlFor="store-description" error={errors.description} hint={`${input.description.length}/300`}>
          <textarea id="store-description" value={input.description} maxLength={300} rows={2} onChange={(event) => set('description', event.target.value)} className={inputClass} placeholder="例如：低油低鹽的舒肥雞胸便當，每天現做" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="店家電話" htmlFor="store-phone" error={errors.phone}>
            <input id="store-phone" type="tel" value={input.phone} onChange={(event) => set('phone', event.target.value)} className={inputClass} placeholder="02-23456789" />
          </Field>
          <Field label="店家地址" htmlFor="store-address" error={errors.address}>
            <input id="store-address" value={input.address} maxLength={200} onChange={(event) => set('address', event.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={fillLocation} className={secondaryButton}><LocateFixed className="h-4 w-4" />在店裡時，用目前位置設定座標</button>
          <span className="text-slate-500">{input.lat !== null && input.lng !== null ? `已設定座標（${input.lat}, ${input.lng}）` : '設定座標後，顧客可以看到距離（選填）'}</span>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-slate-700">封面照片（選填）</p>
          <div className="flex items-center gap-4">
            <div className="h-20 w-32 overflow-hidden rounded-xl bg-slate-100">{input.coverImageUrl && <img src={input.coverImageUrl} alt="封面預覽" className="h-full w-full object-cover" />}</div>
            <label className={`${secondaryButton} cursor-pointer`}>
              {uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}上傳照片
              <input type="file" accept="image/*" className="sr-only" onChange={uploadCover} disabled={uploading} />
            </label>
            {input.coverImageUrl && <button type="button" onClick={() => set('coverImageUrl', '')} className="text-sm text-slate-500 hover:underline">移除</button>}
          </div>
        </div>
      </section>

      <section className={`${card} space-y-3 p-5`}>
        <h2 className="font-black text-slate-900">營業時間</h2>
        <p className="text-xs text-slate-500">顧客只能在營業時間內下單；臨時休息可以在後台上方切換「暫停接單」。</p>
        <OpeningHoursEditor value={input.openingHours} onChange={(slots) => set('openingHours', slots)} />
        {errors.openingHours && <p className="text-xs font-medium text-red-600">{errors.openingHours}</p>}
      </section>

      <section className={`${card} space-y-4 p-5`}>
        <h2 className="font-black text-slate-900">取餐方式與費用</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={input.pickupEnabled} onChange={(event) => set('pickupEnabled', event.target.checked)} className="accent-teal-600" />提供到店自取</label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={input.deliveryEnabled} onChange={(event) => set('deliveryEnabled', event.target.checked)} className="accent-teal-600" />提供店家自行外送</label>
        </div>
        {errors.fulfillment && <p className="text-xs font-medium text-red-600">{errors.fulfillment}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {input.deliveryEnabled && numberField('deliveryFee', '外送費 (NT$)')}
          {numberField('serviceFee', '服務費 (NT$)', '每張訂單加收，可填 0')}
          {numberField('discount', '每單折扣 (NT$)', '每張訂單折抵，可填 0')}
          {numberField('minOrderAmount', '最低消費 (NT$)', '餐點小計需達到此金額')}
          {numberField('prepMinutes', '平均備餐時間（分鐘）')}
        </div>
      </section>

      <button type="submit" disabled={saving} className={`${primaryButton} w-full py-3 text-base`}>{saving && <Spinner className="h-4 w-4" />}{submitLabel}</button>
    </form>
  );
};
