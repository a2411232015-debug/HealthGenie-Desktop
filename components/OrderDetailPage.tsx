import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  MapPin,
  Receipt,
  RefreshCcw,
  Store,
  XCircle,
} from 'lucide-react';
import { ICONS } from '../constants';
import { Cart, Order, OrderStatus } from '../types';
import {
  getCart,
  getMerchant,
  getOrders,
  getProducts,
  saveCart,
  updateOrderStatus,
} from '../data/repository';
import { calculateItemSubtotal, formatCurrency } from '../utils/pricing';
import { showToast } from '../utils/notifications';
import { OrderProgressTimeline } from './OrderProgressTimeline';
import { OrderStatusBadge } from './OrderStatusBadge';

interface OrderDetailPageProps {
  orderId: string | null;
  onBack: () => void;
  onGoToCart?: () => void;
}

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ orderId, onBack, onGoToCart }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadOrder = () => {
    setOrder(orderId ? getOrders().find((candidate) => candidate.orderId === orderId) || null : null);
  };

  useEffect(() => {
    loadOrder();
    window.addEventListener('orders_updated', loadOrder);
    return () => window.removeEventListener('orders_updated', loadOrder);
  }, [orderId]);

  const handleCancel = () => {
    if (!order) return;
    const result = updateOrderStatus(order.orderId, OrderStatus.CANCELLED, '使用者自行取消訂單');
    setShowCancelConfirm(false);
    if (result.success) showToast('訂單已取消');
    else showToast(result.message || '訂單取消失敗', 'error');
  };

  const handleReorder = () => {
    if (!order) return;
    const products = getProducts();
    const unavailable = order.items.find((item) =>
      products.find((product) => product.id === item.productId)?.available !== true,
    );
    if (unavailable) {
      showToast(`「${unavailable.itemName}」目前已售完，無法再次訂購`, 'error');
      return;
    }
    if (getMerchant(order.merchantId)?.acceptingOrders === false) {
      showToast('店家目前暫停接單', 'error');
      return;
    }
    const current = getCart();
    if (current.items.length > 0 && current.merchantId !== order.merchantId) {
      if (!window.confirm('購物車已有其他商家的餐點。是否清空目前購物車並再次訂購？')) return;
    }
    const cart: Cart = {
      merchantId: order.merchantId,
      merchantName: order.storeName,
      items: order.items.map((item) => ({
        ...item,
        id: `reorder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      })),
    };
    if (saveCart(cart)) {
      showToast('餐點已加入購物車');
      onGoToCart?.();
    } else showToast('再次訂購失敗，請稍後再試', 'error');
  };

  if (!orderId || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">找不到訂單</h2>
        <button onClick={onBack} className="mt-6 bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold">返回我的訂單</button>
      </div>
    );
  }

  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isRejected = order.status === OrderStatus.REJECTED;
  const canCancel = order.status === OrderStatus.PENDING || order.status === OrderStatus.PREPARING;

  return (
    <div className="w-full max-w-[800px] mx-auto pb-8 animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200">{ICONS.ArrowLeft}</button>
        <h1 className="text-2xl font-bold text-slate-900">訂單詳情</h1>
      </div>

      <div className="space-y-6">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-800">
                {isCancelled ? '訂單已取消' : isRejected ? '商家已拒絕訂單' : '訂單處理進度'}
              </h2>
              <OrderStatusBadge status={order.status} />
            </div>
            {!isCancelled && !isRejected && (
              <p className="flex items-center gap-2 text-2xl font-black text-teal-600 mt-3">
                <Clock className="w-6 h-6" /> {order.estimatedArrival}
              </p>
            )}
            <p className="text-sm text-slate-500 mt-2">訂單編號：{order.orderId}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={handleReorder} className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl">
              <RefreshCcw className="w-4 h-4" /> 再次訂購
            </button>
            {canCancel && (
              <button onClick={() => setShowCancelConfirm(true)} className="flex items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-100">
                <XCircle className="w-4 h-4" /> 取消訂單
              </button>
            )}
          </div>
        </section>

        {isCancelled || isRejected ? (
          <section className="bg-red-50 p-6 rounded-2xl border border-red-100 flex gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h3 className="font-bold text-red-800">{isRejected ? '拒單原因' : '取消原因'}</h3>
              <p className="text-red-600 mt-1">{order.cancelReason || '無提供原因'}</p>
            </div>
          </section>
        ) : <OrderProgressTimeline status={order.status} history={order.statusHistory} />}

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Store className="w-5 h-5 text-teal-600" /> 店家資訊</h3>
            <p className="font-bold text-lg mt-4">{order.storeName}</p>
            <p className="text-slate-500">{order.storePhone}</p>
            <button onClick={() => { window.location.href = `tel:${order.storePhone}`; }} className="mt-4 w-full py-2.5 bg-teal-50 text-teal-700 font-bold rounded-xl flex items-center justify-center gap-2">
              {ICONS.Phone} 聯絡店家
            </button>
          </section>
          <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-teal-600" /> 外送資訊</h3>
            <p className="text-xs text-slate-400 mt-4">外送地址</p>
            <p className="font-medium text-slate-800">{order.address}</p>
            <p className="text-xs text-slate-400 mt-3">備註</p>
            <p className="font-medium text-slate-800">{order.note || '無'}</p>
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Receipt className="w-5 h-5 text-teal-600" /> 餐點與價格明細</h3>
          </div>
          {order.items.map((item) => (
            <div key={item.id} className="p-6 border-b border-slate-50">
              <div className="flex justify-between gap-4 font-bold text-slate-800">
                <span>{item.itemName} × {item.quantity}</span>
                <span>{formatCurrency(calculateItemSubtotal(item))}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2 space-y-1">
                <p>基本餐盒：{formatCurrency(item.priceBreakdown.basePrice)}</p>
                {item.selectedOptions.map((option) => (
                  <p key={option.optionId}>{option.groupName}：{option.name} {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : '+NT$0'}</p>
                ))}
                <p className="font-bold text-slate-700">單價：{formatCurrency(item.priceBreakdown.unitPrice)}</p>
              </div>
            </div>
          ))}
          <div className="p-6 bg-slate-50/70 space-y-3 text-sm">
            <div className="flex justify-between"><span>小計</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>外送費</span><span>{formatCurrency(order.deliveryFee)}</span></div>
            <div className="flex justify-between"><span>服務費</span><span>{formatCurrency(order.serviceFee)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-600"><span>優惠折抵</span><span>-{formatCurrency(order.discount)}</span></div>}
            <hr className="border-slate-200" />
            <div className="flex justify-between text-lg font-black"><span>總計</span><span>{formatCurrency(order.totalAmount)}</span></div>
          </div>
        </section>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-xl font-bold text-center mt-4">確定要取消訂單嗎？</h3>
            <p className="text-center text-slate-500 text-sm mt-2">取消後無法恢復此訂單。</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">保留訂單</button>
              <button onClick={handleCancel} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold">確認取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
