import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Clock, MapPin, Phone, CheckCircle2, XCircle, ChevronRight, Store, AlertTriangle } from 'lucide-react';

export const MerchantOrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');

  const loadOrders = () => {
    const saved = localStorage.getItem('user_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setOrders(parsed);
          return;
        }
      } catch (e) {
        console.error('Failed to parse orders', e);
      }
    }
    setOrders([]);
  };

  useEffect(() => {
    loadOrders();
    // 監聽來自其他頁面（或未來擴充）的更新事件
    const handleUpdate = () => loadOrders();
    window.addEventListener('orders_updated', handleUpdate);
    return () => window.removeEventListener('orders_updated', handleUpdate);
  }, []);

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus, reason?: string) => {
    const updatedOrders = orders.map(order => {
      if (order.orderId === orderId) {
        return { 
          ...order, 
          status: newStatus,
          ...(reason ? { cancelReason: reason } : {})
        };
      }
      return order;
    });

    setOrders(updatedOrders);
    localStorage.setItem('user_orders', JSON.stringify(updatedOrders));
    window.dispatchEvent(new Event('orders_updated'));
  };

  const handleAction = (order: Order, action: 'accept' | 'reject' | 'ready' | 'pickup' | 'complete') => {
    switch (action) {
      case 'accept':
        updateOrderStatus(order.orderId, OrderStatus.PREPARING);
        alert('已接單，訂單進入製作中');
        break;
      case 'reject':
        if (window.confirm('確定要拒絕此訂單嗎？')) {
          updateOrderStatus(order.orderId, OrderStatus.CANCELLED, '商家暫時無法接單');
        }
        break;
      case 'ready':
        updateOrderStatus(order.orderId, OrderStatus.WAITING_PICKUP);
        alert('餐點已完成，等待外送員取餐');
        break;
      case 'pickup':
        updateOrderStatus(order.orderId, OrderStatus.DELIVERING);
        alert('訂單已交給外送員配送中');
        break;
      case 'complete':
        // 商家端不再處理完成訂單，這段可以保留防呆或刪除，因為按鈕已經移除
        updateOrderStatus(order.orderId, OrderStatus.COMPLETED);
        alert('訂單已完成');
        break;
    }
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => activeTab === 'ALL' || order.status === activeTab)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeTab]);

  const tabs = [
    { id: 'ALL', label: '全部' },
    { id: OrderStatus.PENDING, label: '新訂單' },
    { id: OrderStatus.PREPARING, label: '製作中' },
    { id: OrderStatus.WAITING_PICKUP, label: '等待外送員' },
    { id: OrderStatus.DELIVERING, label: '配送中' },
    { id: OrderStatus.COMPLETED, label: '已完成' },
    { id: OrderStatus.CANCELLED, label: '已取消' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black text-slate-800">訂單管理</h2>
        <p className="text-slate-500">查看顧客訂單並更新製作狀態</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as OrderStatus | 'ALL')}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-teal-500 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order List */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
          <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">目前沒有新訂單</h3>
          <p className="text-slate-500 mt-2">請先從使用者端完成一筆測試下單。</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
          <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">此分類無訂單</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map(order => {
            const isPending = order.status === OrderStatus.PENDING;
            const isCompleted = order.status === OrderStatus.COMPLETED;
            const isCancelled = order.status === OrderStatus.CANCELLED;

            const orderDate = new Date(order.createdAt);
            const formattedDate = `${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

            return (
              <div 
                key={order.orderId} 
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all relative
                  ${isPending ? 'border-teal-400 ring-1 ring-teal-400 shadow-teal-500/10' : 'border-slate-200'}
                  ${(isCompleted || isCancelled) ? 'opacity-70' : ''}
                `}
              >
                {isPending && (
                  <div className="absolute top-0 right-0 bg-teal-500 text-white px-3 py-1 rounded-bl-xl font-bold text-xs shadow-sm z-10 flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    新訂單
                  </div>
                )}
                
                <div className="p-6 md:p-8 flex flex-col xl:flex-row gap-8">
                  {/* Left Column: Info */}
                  <div className="flex-1 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-black text-slate-800">{order.orderId}</h3>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <Clock className="w-4 h-4" /> {formattedDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block mb-1">付款方式: {order.paymentMethod}</span>
                        <span className="text-2xl font-black text-teal-600">${order.totalAmount}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex gap-3">
                        <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500 font-bold mb-0.5">外送地址</p>
                          <p className="text-sm text-slate-800 font-medium">{order.address}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500 font-bold mb-0.5">聯絡電話</p>
                          <p className="text-sm text-slate-800 font-medium">{order.storePhone || '0900-000-000'}</p>
                        </div>
                      </div>
                      {order.note && (
                        <div className="col-span-1 md:col-span-2 mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-500 font-bold mb-0.5">顧客備註</p>
                          <p className="text-sm text-amber-700 font-medium bg-amber-50 p-2 rounded-lg">{order.note}</p>
                        </div>
                      )}
                      {isCancelled && order.cancelReason && (
                        <div className="col-span-1 md:col-span-2 mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-red-500 font-bold mb-0.5">取消原因</p>
                          <p className="text-sm text-red-700 font-medium bg-red-50 p-2 rounded-lg">{order.cancelReason}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden xl:block w-px bg-slate-200" />

                  {/* Right Column: Items & Actions */}
                  <div className="xl:w-[400px] shrink-0 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">餐點明細</h4>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">🥗</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-bold text-slate-800 text-sm">{item.itemName}</p>
                              <p className="font-bold text-slate-700 text-sm">x{item.quantity}</p>
                            </div>
                            {item.customOptions && item.customOptions.length > 0 && (
                              <p className="text-xs text-slate-500 mt-1">{item.customOptions.join(' / ')}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    {!(isCompleted || isCancelled) && (
                      <div className="pt-4 border-t border-slate-100">
                        {isPending && (
                          <div className="flex gap-3">
                            <button 
                              onClick={() => handleAction(order, 'reject')}
                              className="flex-1 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors border border-red-100"
                            >
                              拒單
                            </button>
                            <button 
                              onClick={() => handleAction(order, 'accept')}
                              className="flex-[2] py-3 bg-teal-500 text-white hover:bg-teal-600 rounded-xl font-bold transition-colors shadow-lg shadow-teal-500/20"
                            >
                              接單 (開始製作)
                            </button>
                          </div>
                        )}
                        {order.status === OrderStatus.PREPARING && (
                          <button 
                            onClick={() => handleAction(order, 'ready')}
                            className="w-full py-3 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-bold transition-colors shadow-md shadow-blue-500/20"
                          >
                            完成製作
                          </button>
                        )}
                        {order.status === OrderStatus.WAITING_PICKUP && (
                          <button 
                            onClick={() => handleAction(order, 'pickup')}
                            className="w-full py-3 bg-indigo-500 text-white hover:bg-indigo-600 rounded-xl font-bold transition-colors shadow-md shadow-indigo-500/20"
                          >
                            已交給外送員
                          </button>
                        )}
                        {order.status === OrderStatus.DELIVERING && (
                          <div className="w-full py-3 bg-slate-50 text-slate-500 rounded-xl font-bold text-center border border-slate-200 flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5" /> 餐點配送中，等待顧客確認收餐
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
