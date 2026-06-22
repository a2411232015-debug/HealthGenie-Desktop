import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, ChevronRight, Phone, Clock, CheckCircle2 } from 'lucide-react';
import { trackEvent } from '../utils/merchantAnalytics';
import { CheckoutData } from './ShoppingCart';

import { Order, OrderStatus } from '../types';

interface CheckoutProps {
  data: CheckoutData | null;
  onBack: () => void;
  onPlaceOrder?: (orderId: string) => void;
}

export default function Checkout({ data, onBack, onPlaceOrder }: CheckoutProps) {
  const [deliveryMode, setDeliveryMode] = useState<'外送' | '自取'>('外送');
  const [needInvoice, setNeedInvoice] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  // 防呆機制：若無資料則強制返回
  useEffect(() => {
    if (!data || data.itemsCount === 0) {
      onBack();
    }
  }, [data, onBack]);

  const itemsCount = data?.itemsCount || 0;
  const subtotal = data?.subtotal || 0;

  // Real financial calculation
  const financials = {
    itemsCount,
    subtotal,
    deliveryFee: deliveryMode === '外送' ? 30 : 0,
    serviceFee: 15,
    discount: 15,
  };
  const total = Math.max(0, financials.subtotal + financials.deliveryFee + financials.serviceFee - financials.discount);

  const handlePlaceOrder = () => {
    if (!data) return;

    // 1. Create Order
    const newOrderId = `HG${new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14)}`;
    
    // Store name is from first item or "多間商店"
    const storeName = data.items && data.items.length > 0 
      ? Array.from(new Set(data.items.map(i => i.storeName))).join(' & ') 
      : 'HealthGenie';

    const newOrder: Order = {
      orderId: newOrderId,
      storeName: storeName,
      storePhone: '0912-345-678', // mock
      items: data.items || [],
      totalAmount: total,
      deliveryFee: financials.deliveryFee,
      serviceFee: financials.serviceFee,
      discount: financials.discount,
      address: '台北市大安區安和路一段165號', // mock
      estimatedArrival: '11:51 PM', // mock
      createdAt: new Date().toISOString(),
      status: OrderStatus.PENDING,
      paymentMethod: 'LINE Pay',
      note: ''
    };

    // 2. Save to localStorage
    const savedOrders = localStorage.getItem('user_orders');
    let orders: Order[] = [];
    if (savedOrders) {
      try { orders = JSON.parse(savedOrders); } catch(e) {}
    }
    orders.unshift(newOrder); // Add to top
    localStorage.setItem('user_orders', JSON.stringify(orders));
    window.dispatchEvent(new Event('orders_updated'));

    // Track event
    trackEvent('order_created', {
      storeName: storeName,
      amount: data.subtotal,
      metadata: {
        orderId: newOrderId,
        itemsCount: data.itemsCount,
        paymentMethod: newOrder.paymentMethod,
        deliveryFee: newOrder.deliveryFee,
        serviceFee: newOrder.serviceFee,
        discount: newOrder.discount
      }
    });

    // 3. Clear from cart
    if (data.items) {
      const savedCart = localStorage.getItem('user_cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          // Remove items that have matching name in data.items
          const checkedOutItemNames = new Set(data.items.map(i => i.itemName));
          
          const newCart = parsedCart.map((store: any) => ({
            ...store,
            products: store.products.filter((p: any) => !checkedOutItemNames.has(p.name))
          })).filter((store: any) => store.products.length > 0);
          
          localStorage.setItem('user_cart', JSON.stringify(newCart));
        } catch(e) {}
      }
    }

    // 4. Show success & Navigate
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onPlaceOrder?.(newOrderId);
    }, 1500);
  };

  if (!data) return null;

  return (
    <div className="bg-slate-50 min-h-full pb-24 md:pb-8 flex flex-col relative w-full h-full animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-8 duration-300">
          <div className="bg-teal-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            訂單已送出，正在等待商家接單
          </div>
        </div>
      )}
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-20 bg-white px-4 py-4 flex items-center justify-between shadow-sm md:hidden w-full shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">結帳</h1>
        <div className="w-9" /> {/* Spacer */}
      </div>

      <div className="md:w-full md:grid md:grid-cols-12 md:gap-8 md:pt-8 md:px-8 py-4">
        
        {/* Left Column */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700 transition">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-slate-900">結帳</h1>
          </div>

          {/* Delivery Mode Toggle */}
          <div className="mx-4 md:mx-0 bg-slate-100/80 p-1 rounded-xl flex">
            {['外送', '自取'].map((mode) => (
              <button
                key={mode}
                onClick={() => setDeliveryMode(mode as any)}
                className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
                  deliveryMode === mode 
                    ? 'bg-teal-500 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Delivery Details Block */}
          {deliveryMode === '外送' && (
            <div className="bg-white mx-4 md:mx-0 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Map Embedded iframe */}
              <div className="relative w-full h-48 rounded-t-2xl overflow-hidden bg-slate-200">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3615.002735702202!2d121.54960307595604!3d25.033968738292853!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3442abccaec04c7b%3A0x6aebdd0b769ea8e7!2zMTA25Y-w5YyX5biC5aSn5a6J5Y2A5a6J5ZKM6Lev5LiA5q61MTY16Jmf!5e0!3m2!1szh-TW!2stw!4v1700000000000!5m2!1szh-TW!2stw"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
                
                {/* 懸浮按鈕：編輯大頭針 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                  <button className="bg-white text-slate-700 px-5 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 z-10 hover:bg-slate-50 active:scale-95 transition-transform border border-slate-100">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    編輯大頭針點
                  </button>
                </div>
              </div>
              
              {/* Info Items */}
              <div className="p-5 flex flex-col gap-5">
                <div className="flex justify-between items-center cursor-pointer hover:bg-slate-50 -mx-5 px-5 py-1">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">安和路一段165號</h3>
                    <p className="text-sm text-slate-500 mt-1">台北市 大安區</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                
                <hr className="border-slate-100 border-t-2 border-dashed" />
                
                <div className="flex flex-col items-start gap-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                    在我家門口碰面
                  </h4>
                  <button className="text-teal-600 text-sm font-bold mt-1 pl-4 hover:underline">新增外送指示和相片</button>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Time & Contact */}
          <div className="bg-white mx-4 md:mx-0 p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">預估{deliveryMode}時間</h4>
                <p className="text-sm text-slate-500">11:39 - 11:51 PM</p>
              </div>
            </div>
            
            <hr className="border-slate-100" />
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">聯絡電話</h4>
                <p className="text-sm text-slate-500">0912-345-678</p>
              </div>
              <button className="text-sm font-bold text-teal-600 px-3 py-1 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors">
                修改
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Financials */}
        <div className="md:col-span-5 lg:col-span-4 mt-6 md:mt-0 flex flex-col gap-6">
          <div className="bg-white mx-4 md:mx-0 p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4">訂單摘要 ({financials.itemsCount} 件)</h2>
            
            {/* Promo Banner */}
            <div className="bg-gradient-to-r from-teal-50 to-teal-100/50 border border-teal-200/50 p-4 rounded-xl mb-6 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-teal-800">使用優惠，為您省下 $15</h4>
                <p className="text-xs text-teal-600 mt-1">已自動套用至此筆訂單</p>
              </div>
            </div>

            {/* Financial Grid */}
            <div className="space-y-3 text-slate-600 text-sm">
              <div className="flex justify-between">
                <span>小計</span>
                <span className="font-medium">${financials.subtotal}</span>
              </div>
              {deliveryMode === '外送' && (
                <div className="flex justify-between">
                  <span>外送費</span>
                  <span className="font-medium">${financials.deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>服務費</span>
                <span className="font-medium">${financials.serviceFee}</span>
              </div>
              <div className="flex justify-between text-green-600 font-medium">
                <span>外送優惠</span>
                <span>-${financials.discount}</span>
              </div>
            </div>

            <hr className="border-slate-100 my-4" />
            
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900 text-lg">總計</span>
              <span className="font-black text-2xl text-slate-900">${total}</span>
            </div>
          </div>

          {/* Payment & Invoice Box */}
          <div className="bg-white mx-4 md:mx-0 p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-5 mb-24 md:mb-0">
            <div>
              <h4 className="font-bold text-slate-900 mb-3">付款方式</h4>
              <div className="flex items-center justify-between p-4 border-2 border-teal-500 bg-teal-50/50 rounded-xl cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#06C755] rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                    LINE
                  </div>
                  <span className="font-bold text-teal-900">LINE Pay</span>
                </div>
                <div className="w-5 h-5 rounded-full border-[5px] border-teal-500 bg-white"></div>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div>
              <h4 className="font-bold text-slate-900 mb-3">電子發票</h4>
              <label className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer border border-transparent hover:border-slate-100">
                <input 
                  type="checkbox" 
                  checked={needInvoice} 
                  onChange={() => setNeedInvoice(!needInvoice)}
                  className="w-5 h-5 accent-teal-500 text-white border-gray-300 rounded focus:ring-teal-500 shadow-sm cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">開立電子發票</span>
              </label>
            </div>
          </div>
          
          {/* Desktop Sticky Area (Only visible naturally since we're in right col) */}
          <div className="hidden md:block">
            <button 
              onClick={handlePlaceOrder}
              className="w-full py-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold text-lg shadow-[0_8px_20px_-6px_rgba(20,184,166,0.5)] transition-all active:scale-95 text-center block"
            >
              下訂單
            </button>
            <p className="text-center text-xs text-slate-400 mt-4 font-medium">按下訂單即表示您同意 HealthGenie 服務條款</p>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] md:hidden z-20 pb-safe">
        <button 
          onClick={handlePlaceOrder}
          className="w-full py-4 bg-teal-500 hover:bg-teal-500 text-white rounded-xl font-bold text-lg shadow-[0_8px_20px_-6px_rgba(20,184,166,0.5)] transition-all active:scale-95 text-center block focus:bg-teal-600"
        >
          下訂單 • ${total}
        </button>
      </div>
    </div>
  );
}
