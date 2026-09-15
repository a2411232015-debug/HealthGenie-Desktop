import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Phone,
} from 'lucide-react';
import { CheckoutData } from './ShoppingCart';
import { Order, OrderItem, OrderStatus } from '../types';
import {
  clearCart,
  createOrder,
  getCart,
  getMerchant,
  getProducts,
  getUser,
  saveCart,
  saveUser,
} from '../data/repository';
import { calculateItemSubtotal, formatCurrency } from '../utils/pricing';
import { showToast } from '../utils/notifications';
import { trackEvent } from '../utils/merchantAnalytics';

interface CheckoutProps {
  data: CheckoutData | null;
  onBack: () => void;
  onPlaceOrder?: (orderId: string) => void;
}

const isValidPhone = (phone: string): boolean =>
  /^(?:0\d{1,2}-?\d{6,8}|09\d{2}-?\d{3}-?\d{3})$/.test(phone.replace(/\s/g, ''));

export default function Checkout({ data, onBack, onPlaceOrder }: CheckoutProps) {
  const user = useMemo(() => getUser(), []);
  const [deliveryMode, setDeliveryMode] = useState<'外送' | '自取'>('外送');
  const [needInvoice, setNeedInvoice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phone, setPhone] = useState(user.profile.phone || '');
  const [address, setAddress] = useState(user.profile.address || '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clientRequestId = useRef(
    globalThis.crypto?.randomUUID?.() || `request_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (!data || data.itemsCount === 0) onBack();
  }, [data, onBack]);

  if (!data) return null;

  const merchant = getMerchant(data.merchantId);
  const subtotal = data.items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  const deliveryFee = deliveryMode === '外送' ? (merchant?.deliveryFee || 0) : 0;
  const serviceFee = merchant?.serviceFee || 0;
  const discount = merchant?.discount || 0;
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!isValidPhone(phone)) nextErrors.phone = '請輸入合法的電話號碼';
    if (deliveryMode === '外送' && !address.trim()) nextErrors.address = '地址為必填';
    if (note.length > 100) nextErrors.note = '備註最多 100 字';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveContact = () => {
    if (!isValidPhone(phone)) {
      setErrors((current) => ({ ...current, phone: '請輸入合法的電話號碼' }));
      return;
    }
    const nextUser = {
      ...user,
      profile: { ...user.profile, phone, address },
    };
    if (saveUser(nextUser)) {
      setIsEditingPhone(false);
      setErrors((current) => ({ ...current, phone: '' }));
      showToast('聯絡資料已儲存');
    } else {
      showToast('聯絡資料儲存失敗', 'error');
    }
  };

  const handlePlaceOrder = async () => {
    if (isSubmitting || !validate()) return;
    const latestMerchant = getMerchant(data.merchantId);
    if (!latestMerchant || !latestMerchant.acceptingOrders) {
      showToast('店家目前暫停接單', 'error');
      return;
    }
    const products = getProducts();
    const unavailable = data.items.find((item) =>
      products.find((product) => product.id === item.productId)?.available !== true,
    );
    if (unavailable) {
      showToast(`「${unavailable.name}」已售完，請返回購物車移除`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const now = new Date();
      const orderItems: OrderItem[] = data.items.map((item) => ({
        ...item,
        itemName: item.name,
        customOptions: item.selectedOptions.map((option) => `${option.groupName}：${option.name}`),
        price: item.priceBreakdown.unitPrice,
        subtotal: calculateItemSubtotal(item),
      }));
      const newOrder: Order = {
        orderId: `HG${now.toISOString().replace(/\D/g, '').slice(0, 14)}`,
        clientRequestId: clientRequestId.current,
        merchantId: data.merchantId,
        storeName: data.merchantName,
        storePhone: latestMerchant.phone,
        items: orderItems,
        subtotal,
        totalAmount: total,
        deliveryFee,
        serviceFee,
        discount,
        address: deliveryMode === '外送' ? address.trim() : latestMerchant.address,
        estimatedArrival: deliveryMode === '外送' ? '約 30–40 分鐘' : '約 20–30 分鐘',
        createdAt: now.toISOString(),
        status: OrderStatus.PENDING,
        statusHistory: [{ status: OrderStatus.PENDING, timestamp: now.toISOString() }],
        paymentMethod: 'LINE Pay',
        note: note.trim(),
      };

      const result = createOrder(newOrder);
      trackEvent('order_created', {
        storeName: data.merchantName,
        amount: total,
        metadata: {
          orderId: result.order.orderId,
          clientRequestId: clientRequestId.current,
          itemsCount: data.itemsCount,
        },
      });

      const checkedOutIds = new Set(data.items.map((item) => item.id));
      const cart = getCart();
      const remaining = cart.items.filter((item) => !checkedOutIds.has(item.id));
      if (remaining.length === 0) clearCart();
      else saveCart({
        merchantId: remaining[0].merchantId,
        merchantName: remaining[0].merchantName,
        items: remaining,
      });

      showToast(result.created ? '訂單已建立，等待商家接單' : '此訂單已建立，未重複送出');
      window.setTimeout(() => onPlaceOrder?.(result.order.orderId), 350);
    } catch (error) {
      setIsSubmitting(false);
      showToast(error instanceof Error ? `訂單建立失敗：${error.message}` : '訂單建立失敗，請稍後再試', 'error');
    }
  };

  return (
    <div className="bg-slate-50 min-h-full pb-24 md:pb-8 w-full animate-in fade-in slide-in-from-right-4">
      <div className="md:grid md:grid-cols-12 md:gap-8 md:px-8">
        <div className="md:col-span-7 lg:col-span-8 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} disabled={isSubmitting} className="p-2 rounded-full hover:bg-slate-200 disabled:opacity-40">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900">結帳</h1>
              <p className="text-sm text-slate-500 mt-1">{data.merchantName}</p>
            </div>
          </div>

          <div className="bg-slate-100 p-1 rounded-xl flex">
            {(['外送', '自取'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDeliveryMode(mode)}
                disabled={isSubmitting}
                className={`flex-1 py-3 text-sm font-bold rounded-lg ${deliveryMode === mode ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          {deliveryMode === '外送' && (
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-44 bg-gradient-to-br from-teal-50 to-slate-200 flex items-center justify-center">
                <button onClick={() => showToast('此功能目前為展示版本，尚未開放。', 'info')} className="bg-white px-5 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-600" /> 編輯大頭針點
                </button>
              </div>
              <div className="p-5">
                <label htmlFor="checkout-address" className="font-bold text-slate-800">外送地址</label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="checkout-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    disabled={isSubmitting}
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-3"
                  />
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                {errors.address && <p className="text-red-500 text-xs mt-1.5">{errors.address}</p>}
                <button onClick={() => showToast('此功能目前為展示版本，尚未開放。', 'info')} className="text-teal-600 text-sm font-bold mt-4 hover:underline">
                  新增外送指示和相片
                </button>
              </div>
            </section>
          )}

          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600"><Clock className="w-5 h-5" /></div>
              <div>
                <h4 className="font-bold text-slate-900">預估{deliveryMode}時間</h4>
                <p className="text-sm text-slate-500">{deliveryMode === '外送' ? '約 30–40 分鐘' : '約 20–30 分鐘'}</p>
              </div>
            </div>
            <hr className="border-slate-100" />
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600"><Phone className="w-5 h-5" /></div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">聯絡電話</h4>
                {isEditingPhone ? (
                  <div className="mt-2">
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setIsEditingPhone(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-bold">取消</button>
                      <button onClick={saveContact} className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm font-bold">儲存電話</button>
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-500 mt-1">{phone}</p>}
              </div>
              {!isEditingPhone && <button onClick={() => setIsEditingPhone(true)} className="text-sm font-bold text-teal-600 px-3 py-1 bg-teal-50 rounded-lg">修改電話</button>}
            </div>
            <hr className="border-slate-100" />
            <div>
              <label htmlFor="checkout-note" className="font-bold text-slate-900">訂單備註</label>
              <textarea id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={100} className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 min-h-20" placeholder="最多 100 字" />
              <div className="flex justify-between mt-1">
                {errors.note ? <p className="text-red-500 text-xs">{errors.note}</p> : <span />}
                <p className="text-xs text-slate-400">{note.length}/100</p>
              </div>
            </div>
          </section>
        </div>

        <div className="md:col-span-5 lg:col-span-4 mt-6 md:mt-0 space-y-5">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-black text-slate-900">訂單摘要（{data.itemsCount} 件）</h2>
            <div className="mt-4 space-y-3">
              {data.items.map((item) => (
                <div key={item.id} className="text-sm border-b border-slate-50 pb-3">
                  <div className="flex justify-between gap-3 font-bold text-slate-800">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{formatCurrency(calculateItemSubtotal(item))}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    基本價 {formatCurrency(item.priceBreakdown.basePrice)}
                    {item.selectedOptions.map((option) => ` · ${option.name} +${formatCurrency(option.priceDelta)}`).join('')}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-sm text-slate-600 mt-4">
              <div className="flex justify-between"><span>小計</span><span>{formatCurrency(subtotal)}</span></div>
              {deliveryMode === '外送' && <div className="flex justify-between"><span>外送費</span><span>{formatCurrency(deliveryFee)}</span></div>}
              <div className="flex justify-between"><span>服務費</span><span>{formatCurrency(serviceFee)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>優惠折抵</span><span>-{formatCurrency(discount)}</span></div>}
              <hr className="border-slate-100" />
              <div className="flex justify-between text-lg font-black text-slate-900"><span>總計</span><span>{formatCurrency(total)}</span></div>
            </div>
          </section>

          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h4 className="font-bold text-slate-900 mb-3">付款方式</h4>
            <div className="flex items-center justify-between p-4 border-2 border-teal-500 bg-teal-50 rounded-xl">
              <span className="font-bold text-teal-900">LINE Pay</span>
              <div className="w-5 h-5 rounded-full border-[5px] border-teal-500 bg-white" />
            </div>
            <label className="flex items-center gap-3 mt-4 text-sm font-medium">
              <input type="checkbox" checked={needInvoice} onChange={() => setNeedInvoice((value) => !value)} className="accent-teal-500" />
              開立電子發票
            </label>
          </section>

          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            className="w-full py-4 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white rounded-xl font-black text-lg flex items-center justify-center gap-2"
          >
            {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> 訂單建立中……</> : <>下訂單 · {formatCurrency(total)}</>}
          </button>
          <p className="text-center text-xs text-slate-400">按下訂單即表示您同意 HealthGenie 服務條款</p>
        </div>
      </div>
    </div>
  );
}
