import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Bike, Clock, MapPin, ShoppingBag } from 'lucide-react';
import { ApiError, placeOrder, updateProfile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { clearCart } from '../../lib/cart';
import { newId } from '../../lib/id';
import { navigate } from '../../lib/router';
import { Fulfillment } from '../../types';
import { isValidPhone } from '../../utils/format';
import { slotLabel, upcomingSlots } from '../../utils/hours';
import { errorMessage, showToast } from '../../utils/notifications';
import { computeTotals, formatCurrency } from '../../utils/pricing';
import { ErrorState, Field, PageHeader, PageLoading, Spinner, card, inputClass, primaryButton } from '../ui';
import { storeState, STORE_STATE_LABEL } from './storeStatus';
import { useCartStore } from './useCartStore';

export const CheckoutPage: React.FC = () => {
  const { userId, profile, setProfile } = useAuth();
  const { cart, merchant, unavailable, loading, error, reload } = useCartStore();
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [timing, setTiming] = useState<'asap' | 'scheduled'>('asap');
  const [slot, setSlot] = useState('');
  const [now, setNow] = useState(() => new Date());
  const requestId = useRef(newId());
  const prefilled = useRef(false);

  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    setContactName(profile.displayName);
    setContactPhone(profile.phone);
    setAddress(profile.defaultAddress);
  }, [profile]);

  useEffect(() => {
    if (!merchant) return;
    if (!merchant.pickupEnabled) setFulfillment('delivery');
    else if (!merchant.deliveryEnabled) setFulfillment('pickup');
  }, [merchant]);

  useEffect(() => {
    if (!loading && cart.items.length === 0 && !submitting) navigate('/cart', { replace: true });
  }, [loading, cart.items.length, submitting]);

  // 每分鐘更新一次可預約的時段
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const slots = useMemo(
    () => (merchant ? upcomingSlots(merchant.openingHours, merchant.prepMinutes, now) : []),
    [merchant, now],
  );

  const totals = useMemo(
    () => computeTotals(merchant || { deliveryFee: 0, serviceFee: 0, discount: 0 }, cart.items, fulfillment),
    [merchant, cart.items, fulfillment],
  );

  if (loading && !merchant) return <PageLoading />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!merchant) return <ErrorState message="這間店家已經下架，請回購物車" onRetry={() => navigate('/cart')} />;

  const state = storeState(merchant);
  const belowMinimum = merchant.minOrderAmount > totals.subtotal;
  const openNow = state === 'open';
  const canOrder = state !== 'paused' && (openNow || slots.length > 0);
  const effectiveTiming = openNow ? timing : 'scheduled';
  const chosenSlot = slots.some((candidate) => candidate.toISOString() === slot) ? slot : (slots[0]?.toISOString() || '');
  const slotGroups = slots.reduce<Record<string, Date[]>>((groups, candidate) => {
    const day = slotLabel(candidate, now).split(' ')[0];
    return { ...groups, [day]: [...(groups[day] || []), candidate] };
  }, {});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!contactName.trim()) next.contactName = '請填寫訂購人姓名';
    if (!isValidPhone(contactPhone)) next.contactPhone = '請填寫正確的電話，例如 0912345678';
    if (fulfillment === 'delivery' && address.trim().length < 5) next.address = '請填寫完整的外送地址';
    if (effectiveTiming === 'scheduled' && !chosenSlot) next.slot = '請選擇預約時間';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await placeOrder({
        merchantId: merchant.id,
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          optionIds: item.options.map((option) => option.optionId),
          remark: item.remark,
        })),
        fulfillment,
        contactName: contactName.trim(),
        contactPhone: contactPhone.replace(/[\s-]/g, ''),
        deliveryAddress: fulfillment === 'delivery' ? address.trim() : '',
        note: note.trim(),
        clientRequestId: requestId.current,
        expectedTotal: totals.total,
        scheduledFor: effectiveTiming === 'scheduled' ? chosenSlot : null,
      });
      if (remember && userId && profile) {
        const patch = {
          displayName: profile.displayName || contactName.trim(),
          phone: contactPhone.replace(/[\s-]/g, ''),
          defaultAddress: fulfillment === 'delivery' ? address.trim() : profile.defaultAddress,
        };
        updateProfile(userId, patch).then(setProfile).catch(() => undefined);
      }
      clearCart();
      showToast(effectiveTiming === 'scheduled' ? `已預約 ${slotLabel(new Date(chosenSlot))}，等待店家確認` : '訂單已送出，等待店家接單');
      navigate(`/order/${order.id}`, { replace: true });
    } catch (caught) {
      setSubmitting(false);
      if (caught instanceof ApiError && caught.code === 'HG001') {
        await reload();
        setSubmitError(`${caught.message}。價格已重新整理，請再確認一次。`);
      } else {
        setSubmitError(errorMessage(caught, '訂單送出失敗，請稍後再試'));
      }
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="結帳" subtitle={merchant.name} back={() => navigate('/cart')} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <section className={`${card} p-5`}>
            <h2 className="font-black text-slate-900">取餐方式</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {merchant.pickupEnabled && (
                <button type="button" onClick={() => setFulfillment('pickup')} className={`rounded-xl border-2 p-4 text-left ${fulfillment === 'pickup' ? 'border-teal-500 bg-teal-50' : 'border-slate-100'}`}>
                  <ShoppingBag className="h-5 w-5 text-teal-600" />
                  <p className="mt-2 font-bold">到店自取</p>
                  <p className="text-xs text-slate-500">免運費</p>
                </button>
              )}
              {merchant.deliveryEnabled && (
                <button type="button" onClick={() => setFulfillment('delivery')} className={`rounded-xl border-2 p-4 text-left ${fulfillment === 'delivery' ? 'border-teal-500 bg-teal-50' : 'border-slate-100'}`}>
                  <Bike className="h-5 w-5 text-teal-600" />
                  <p className="mt-2 font-bold">店家外送</p>
                  <p className="text-xs text-slate-500">運費 {formatCurrency(merchant.deliveryFee)}</p>
                </button>
              )}
            </div>
            <div className="mt-5">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-700"><Clock className="h-4 w-4" />{fulfillment === 'pickup' ? '取餐時間' : '送達時間'}</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button type="button" disabled={!openNow} onClick={() => setTiming('asap')} className={`rounded-xl border-2 px-4 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${effectiveTiming === 'asap' ? 'border-teal-500 bg-teal-50' : 'border-slate-100'}`}>
                  <span className="block font-bold">盡快</span>
                  <span className="text-xs text-slate-500">{openNow ? `接單後約 ${merchant.prepMinutes} 分鐘${fulfillment === 'delivery' ? '＋配送' : ''}` : '店家休息中'}</span>
                </button>
                <button type="button" disabled={slots.length === 0} onClick={() => setTiming('scheduled')} className={`rounded-xl border-2 px-4 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${effectiveTiming === 'scheduled' ? 'border-teal-500 bg-teal-50' : 'border-slate-100'}`}>
                  <span className="block font-bold">預約時間</span>
                  <span className="text-xs text-slate-500">{slots.length > 0 ? `最早 ${slotLabel(slots[0], now)}` : '近兩天沒有營業時段'}</span>
                </button>
              </div>
              {effectiveTiming === 'scheduled' && slots.length > 0 && (
                <select aria-label="預約時間" value={chosenSlot} onChange={(event) => setSlot(event.target.value)} className={`${inputClass} mt-3`}>
                  {Object.entries(slotGroups).map(([day, daySlots]) => (
                    <optgroup key={day} label={day}>
                      {daySlots.map((candidate) => <option key={candidate.toISOString()} value={candidate.toISOString()}>{slotLabel(candidate, now)}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
              {!openNow && slots.length > 0 && <p className="mt-2 text-xs text-indigo-700">店家現在休息中，可以預約營業時間{fulfillment === 'pickup' ? '取餐' : '送達'}。</p>}
              {errors.slot && <p className="mt-1 text-xs font-medium text-red-600">{errors.slot}</p>}
            </div>
            {fulfillment === 'pickup' && <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4" />取餐地點：{merchant.address}</p>}
          </section>

          <section className={`${card} space-y-4 p-5`}>
            <h2 className="font-black text-slate-900">聯絡資料</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="訂購人姓名" htmlFor="checkout-name" error={errors.contactName}>
                <input id="checkout-name" value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={30} className={inputClass} autoComplete="name" />
              </Field>
              <Field label="手機或電話" htmlFor="checkout-phone" error={errors.contactPhone}>
                <input id="checkout-phone" type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className={inputClass} autoComplete="tel" placeholder="0912345678" />
              </Field>
            </div>
            {fulfillment === 'delivery' && (
              <Field label="外送地址" htmlFor="checkout-address" error={errors.address}>
                <input id="checkout-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={200} className={inputClass} autoComplete="street-address" placeholder="縣市、區、路名、門牌、樓層" />
              </Field>
            )}
            <Field label="給店家的備註（選填）" htmlFor="checkout-note" hint={`${note.length}/200`}>
              <textarea id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={2} className={inputClass} placeholder="例如：餐具不用、到了請打電話" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="accent-teal-600" />
              記住這些資料，下次自動填入
            </label>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="font-black text-slate-900">付款方式</h2>
            <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-teal-500 bg-teal-50 p-4">
              <Banknote className="h-5 w-5 text-teal-700" />
              <div>
                <p className="font-bold text-teal-900">現金付款</p>
                <p className="text-xs text-teal-800">{fulfillment === 'pickup' ? '取餐時付款給店家' : '餐點送達時付款'}</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-2">
          <section className={`${card} sticky top-4 p-5`}>
            <h2 className="font-black text-slate-900">訂單明細</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {cart.items.map((item) => (
                <li key={item.key} className={`py-2.5 ${unavailable.has(item.key) ? 'text-red-600' : ''}`}>
                  <div className="flex justify-between gap-3 font-bold"><span>{item.name} × {item.quantity}</span><span>{formatCurrency(item.unitPrice * item.quantity)}</span></div>
                  {item.options.length > 0 && <p className="text-xs text-slate-500">{item.options.map((option) => option.name).join('、')}</p>}
                  {item.remark && <p className="text-xs text-slate-500">備註：{item.remark}</p>}
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
              <div className="flex justify-between"><dt>小計</dt><dd>{formatCurrency(totals.subtotal)}</dd></div>
              {fulfillment === 'delivery' && <div className="flex justify-between"><dt>外送費</dt><dd>{formatCurrency(totals.deliveryFee)}</dd></div>}
              {totals.serviceFee > 0 && <div className="flex justify-between"><dt>服務費</dt><dd>{formatCurrency(totals.serviceFee)}</dd></div>}
              {totals.discount > 0 && <div className="flex justify-between text-emerald-600"><dt>店家折扣</dt><dd>-{formatCurrency(totals.discount)}</dd></div>}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-black text-slate-900"><dt>應付金額</dt><dd>{formatCurrency(totals.total)}</dd></div>
            </dl>
            {unavailable.size > 0 && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">有餐點已售完，請回購物車移除。</p>}
            {!canOrder && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">店家目前{STORE_STATE_LABEL[state]}，暫時無法下單。</p>}
            {canOrder && effectiveTiming === 'scheduled' && chosenSlot && <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800">預約 {slotLabel(new Date(chosenSlot), now)}{fulfillment === 'pickup' ? '取餐' : '送達'}</p>}
            {belowMinimum && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">未達最低消費 {formatCurrency(merchant.minOrderAmount)}</p>}
            {submitError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{submitError}</p>}
            <button onClick={submit} disabled={submitting || unavailable.size > 0 || !canOrder || belowMinimum} className={`${primaryButton} mt-4 w-full py-3.5 text-base`}>
              {submitting ? <><Spinner className="h-4 w-4" />送出中…</> : `送出訂單 · ${formatCurrency(totals.total)}`}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">付款於{fulfillment === 'pickup' ? '取餐' : '送達'}時進行。送出訂單即表示同意<a href="#/terms" className="underline">服務條款</a>，你的姓名、電話{fulfillment === 'delivery' ? '、地址' : ''}會提供給店家。</p>
          </section>
        </aside>
      </div>
    </div>
  );
};
