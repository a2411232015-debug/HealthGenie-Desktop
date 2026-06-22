import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { MOCK_ORDERS, ICONS } from '../constants';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderProgressTimeline } from './OrderProgressTimeline';
import { Clock, MapPin, Store, Receipt, RefreshCcw, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OrderDetailPageProps {
  orderId: string | null;
  onBack: () => void;
}

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ orderId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadOrderDetails = () => {
    if (!orderId) return;
    
    // 1. Try local storage
    const saved = localStorage.getItem('user_orders');
    if (saved) {
      try {
        const parsed: Order[] = JSON.parse(saved);
        const found = parsed.find(o => o.orderId === orderId);
        if (found) {
          setOrder(found);
          return;
        }
      } catch (e) {
        // ignore
      }
    }
    // 2. Try mock data
    const foundMock = MOCK_ORDERS.find(o => o.orderId === orderId);
    if (foundMock) {
      setOrder(foundMock);
    }
  };

  useEffect(() => {
    loadOrderDetails();
    const handleUpdate = () => loadOrderDetails();
    window.addEventListener('orders_updated', handleUpdate);
    return () => window.removeEventListener('orders_updated', handleUpdate);
  }, [orderId]);

  const handleCancelOrder = () => {
    if (!order) return;
    
    // Update local state
    const updatedOrder = { ...order, status: OrderStatus.CANCELLED, cancelReason: '使用者自行取消訂單' };
    setOrder(updatedOrder);
    
    // Update localStorage if it exists
    const saved = localStorage.getItem('user_orders');
    if (saved) {
      try {
        let parsed: Order[] = JSON.parse(saved);
        parsed = parsed.map(o => o.orderId === order.orderId ? updatedOrder : o);
        localStorage.setItem('user_orders', JSON.stringify(parsed));
      } catch(e) {}
    }
    setShowCancelConfirm(false);
    window.dispatchEvent(new Event('orders_updated'));
  };

  const handleConfirmReceived = () => {
    if (!order) return;
    if (window.confirm('確認已收到餐點嗎？')) {
      const updatedOrder = { 
        ...order, 
        status: OrderStatus.COMPLETED, 
        completedAt: new Date().toISOString() 
      };
      setOrder(updatedOrder);
      
      const saved = localStorage.getItem('user_orders');
      if (saved) {
        try {
          let parsed: Order[] = JSON.parse(saved);
          parsed = parsed.map(o => o.orderId === order.orderId ? updatedOrder : o);
          localStorage.setItem('user_orders', JSON.stringify(parsed));
        } catch(e) {}
      }
      window.dispatchEvent(new Event('orders_updated'));
    }
  };

  const handleReorder = () => {
    alert('【再次訂購】此功能為後續擴充功能，即將推出！');
  };

  if (!orderId || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">找不到訂單</h2>
        <p className="text-slate-500 mt-2 mb-6">這筆訂單可能不存在或已被移除</p>
        <button 
          onClick={onBack}
          className="bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-600 transition-colors"
        >
          返回我的訂單
        </button>
      </div>
    );
  }

  const isCanceled = order.status === OrderStatus.CANCELLED;
  const canCancel = order.status === OrderStatus.PENDING || order.status === OrderStatus.PREPARING;
  const canConfirmReceive = order.status === OrderStatus.DELIVERING;

  return (
    <div className="w-full max-w-[800px] mx-auto pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700 transition"
        >
          {ICONS.ArrowLeft}
        </button>
        <h1 className="text-2xl font-bold text-slate-900">訂單詳情</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Status Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-black text-slate-800">
                {isCanceled ? '訂單已取消' : '預計送達時間'}
              </h2>
              <OrderStatusBadge status={order.status} />
            </div>
            {!isCanceled && (
              <div className="flex items-center gap-2 text-3xl font-black text-teal-600">
                <Clock className="w-6 h-6" />
                {order.estimatedArrival}
              </div>
            )}
            <p className="text-sm text-slate-500 mt-2">訂單編號: {order.orderId}</p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button 
              onClick={handleReorder}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" /> 再次訂購
            </button>
            {canConfirmReceive && (
              <button 
                onClick={handleConfirmReceived}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" /> 確認已收到餐點
              </button>
            )}
            {canCancel && (
              <button 
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-100"
              >
                <XCircle className="w-4 h-4" /> 取消訂單
              </button>
            )}
          </div>
        </div>

        {/* Progress or Cancel Reason */}
        {isCanceled ? (
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 text-lg">取消原因</h3>
              <p className="text-red-600 mt-1">{order.cancelReason || '無提供原因'}</p>
            </div>
          </div>
        ) : (
          <OrderProgressTimeline status={order.status} />
        )}

        {/* Store & Delivery Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-teal-600" /> 店家資訊
            </h3>
            <p className="font-bold text-lg text-slate-900 mb-1">{order.storeName}</p>
            <p className="text-slate-500 mb-4">{order.storePhone}</p>
            <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-50 text-teal-700 font-bold rounded-xl hover:bg-teal-100 transition-colors">
              {ICONS.Phone} 聯絡店家
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-teal-600" /> 外送資訊
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">外送地址</p>
                <p className="font-medium text-slate-800">{order.address}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">備註</p>
                <p className="font-medium text-slate-800">{order.note || '無'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-600" /> 餐點明細
            </h3>
          </div>
          <div className="flex flex-col">
            {order.items.map((item, idx) => (
              <div key={idx} className="p-4 sm:p-6 border-b border-slate-50 flex gap-4 items-center">
                <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🥗</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-bold text-slate-800 truncate">{item.itemName}</h4>
                    <span className="font-bold text-slate-800">${item.price * item.quantity}</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    數量: {item.quantity}
                  </div>
                  {item.customOptions && item.customOptions.length > 0 && (
                    <div className="text-xs text-slate-400 mt-1">
                      {item.customOptions.join(' / ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Financials */}
          <div className="p-6 bg-slate-50/50 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>小計</span>
              <span className="font-medium">${order.totalAmount - order.deliveryFee - order.serviceFee + order.discount}</span>
            </div>
            <div className="flex justify-between">
              <span>外送費</span>
              <span className="font-medium">${order.deliveryFee}</span>
            </div>
            <div className="flex justify-between">
              <span>服務費</span>
              <span className="font-medium">${order.serviceFee}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>優惠折抵</span>
                <span className="font-medium">-${order.discount}</span>
              </div>
            )}
            <hr className="border-slate-200 my-2" />
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold text-slate-900">總計</span>
              <span className="font-black text-slate-900">${order.totalAmount}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-200 mt-2">
              <span>付款方式</span>
              <span>{order.paymentMethod}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4 text-red-500">
              <AlertCircle className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 mb-2">確定要取消訂單嗎？</h3>
            <p className="text-center text-slate-500 mb-6 text-sm">
              店家若已開始準備，取消可能無法退還全額費用。
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                保留訂單
              </button>
              <button 
                onClick={handleCancelOrder}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                確認取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
