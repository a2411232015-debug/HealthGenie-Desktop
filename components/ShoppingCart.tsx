import React, { useState, useMemo } from 'react';
import { Trash2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { generateHealthWarnings } from '../utils/health';
import { trackEvent } from '../utils/merchantAnalytics';

// --- Mock Data ---
const MOCK_DATA = [
  {
    storeId: 's1',
    storeName: 'Muscle Fuel 健康餐',
    products: [
      {
        id: 'p1',
        name: '舒肥雞胸藜麥餐盒',
        variant: '450 kcal, P: 42g',
        price: 210,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=80&q=80',
        macros: { calories: 530, protein: 57, fat: 8, carbs: 25, sugar: 2, sodium: 450, fiber: 10 },
        customizations: ['飯量減半', '去糖', '加蛋白質'] as string[],
        userRemark: '醬料需另外包裝'
      }
    ]
  },
  {
    storeId: 's2',
    storeName: '老張健康滷',
    products: [
      {
        id: 'p2',
        name: '低脂牛腱滷味拼盤',
        variant: '320 kcal, P: 30g',
        price: 130,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=80&q=80',
        macros: { calories: 320, protein: 30, fat: 10, carbs: 15, sugar: 3, sodium: 850, fiber: 2 }
      }
    ]
  },
  {
    storeId: 's3',
    storeName: 'Daily Fresh 輕食',
    products: [
      {
        id: 'p3',
        name: '香煎鮭魚五穀飯',
        variant: '580 kcal, P: 35g',
        price: 220,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80',
        macros: { calories: 580, protein: 35, fat: 18, carbs: 60, sugar: 3, sodium: 580, fiber: 7 }
      }
    ]
  }
];

export interface CheckoutData {
  itemsCount: number;
  subtotal: number;
  items: Array<{
    itemName: string;
    quantity: number;
    price: number;
    customOptions?: string[];
    imageUrl?: string;
    storeName: string;
  }>;
}

interface ShoppingCartProps {
  onCheckout?: (data: CheckoutData) => void;
}

export default function ShoppingCart({ onCheckout }: ShoppingCartProps) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('user_cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }
    return MOCK_DATA;
  });
  
  React.useEffect(() => {
    localStorage.setItem('user_cart', JSON.stringify(cart));
  }, [cart]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 取得全部可選商品的 id 陣列
  const allProductIds = useMemo(() => cart.flatMap(s => s.products.map(p => p.id)), [cart]);

  // 計算選中的總額、數量與全選狀態
  const { totalPrice, totalCount, isAllSelected } = useMemo(() => {
    let price = 0;
    let count = 0;
    cart.forEach(store => {
      store.products.forEach(p => {
        if (selectedIds.has(p.id)) {
          price += p.price * p.quantity;
          count += p.quantity;
        }
      });
    });
    return {
      totalPrice: price,
      totalCount: count,
      isAllSelected: allProductIds.length > 0 && selectedIds.size === allProductIds.length
    };
  }, [cart, selectedIds, allProductIds]);

  // 計算選中項目的營養素總和
  const totalMacros = useMemo(() => {
    const totals = { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, sodium: 0, fiber: 0 };
    cart.forEach(store => {
      store.products.forEach(p => {
        if (selectedIds.has(p.id) && p.macros) {
          totals.calories += p.macros.calories * p.quantity;
          totals.protein += p.macros.protein * p.quantity;
          totals.fat += p.macros.fat * p.quantity;
          totals.carbs += p.macros.carbs * p.quantity;
          totals.sugar += p.macros.sugar * p.quantity;
          totals.sodium += p.macros.sodium * p.quantity;
          totals.fiber += p.macros.fiber * p.quantity;
        }
      });
    });
    return totals;
  }, [cart, selectedIds]);

  // 這裡依需求暫時建立 Mock 的當日狀態（若未來 ShoppingCart 透過 props 接收可直接替換）
  const userProfile = { tdee: 2000 };
  const dailyIntake = 1200;

  // 動態健康評語邏輯
  const feedbackMessages = useMemo(() => {
    if (selectedIds.size === 0) return [];
    
    // 呼叫智能警示邏輯
    const messages = generateHealthWarnings(
      { calories: totalMacros.calories, macros: totalMacros },
      userProfile,
      dailyIntake
    );
    
    // 將基礎評語加到最前面
    messages.unshift({
      type: 'base',
      text: `這餐共 ${totalMacros.calories} 大卡，蛋白質 ${totalMacros.protein}g。`,
      color: 'text-gray-700 font-bold'
    });

    if (totalMacros.fiber > 10) {
      messages.push({
        type: 'success',
        text: '✨ 膳食纖維豐富，有助腸胃健康！',
        color: 'text-teal-600 font-medium'
      });
    }

    if (totalMacros.carbs < 40 && totalMacros.carbs > 0) {
      messages.push({
        type: 'info',
        text: '📉 適合低碳飲食日。',
        color: 'text-blue-600 font-medium'
      });
    }

    return messages;
  }, [totalMacros, selectedIds]);

  // 單一商品 Toggle
  const toggleProduct = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // 店鋪維度 Toggle
  const toggleStore = (storeId: string) => {
    const store = cart.find(s => s.storeId === storeId);
    if (!store) return;
    
    const storeProductIds = store.products.map(p => p.id);
    const allStoreSelected = storeProductIds.every(id => selectedIds.has(id));
    
    const next = new Set(selectedIds);
    storeProductIds.forEach(id => {
      if (allStoreSelected) next.delete(id);
      else next.add(id);
    });
    setSelectedIds(next);
  };

  // 頂部或底部的「所有全選」Toggle
  const toggleAll = () => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allProductIds));
  };

  // 更新數量
  const updateQuantity = (storeId: string, productId: string, delta: number) => {
    setCart(prev => prev.map(store => {
      if (store.storeId !== storeId) return store;
      return {
        ...store,
        products: store.products.map(p => {
          if (p.id !== productId) return p;
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty };
        })
      };
    }));
  };

  // 刪除單一商品
  const deleteItem = (storeId: string, productId: string) => {
    setCart(prev => prev.map(store => {
      if (store.storeId !== storeId) return store;
      return {
        ...store,
        products: store.products.filter(p => p.id !== productId)
      };
    }).filter(s => s.products.length > 0)); // 若店鋪無商品則一併移除
    
    const next = new Set(selectedIds);
    next.delete(productId);
    setSelectedIds(next);
  };

  // 刪除所選商品
  const deleteSelected = () => {
    setCart(prev => prev.map(store => ({
      ...store,
      products: store.products.filter(p => !selectedIds.has(p.id))
    })).filter(s => s.products.length > 0));
    
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col font-sans h-max bg-gray-50 text-gray-900 rounded-lg max-w-[1200px] mx-auto w-full">
      <div className="flex-1 w-full mx-auto pb-8">
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 bg-white border border-gray-100 p-4 rounded-t-xl shadow-sm mb-4 text-sm text-gray-500 font-medium">
          <div className="col-span-5 flex items-center gap-4">
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-teal-500 cursor-pointer rounded border-gray-300 focus:ring-teal-500 focus:ring-2"
              checked={isAllSelected}
              onChange={toggleAll}
            />
            <span>餐點資訊</span>
          </div>
          <div className="col-span-2 text-center">單價</div>
          <div className="col-span-2 text-center">數量</div>
          <div className="col-span-2 text-right">小計</div>
          <div className="col-span-1 text-center">操作</div>
        </div>

        {/* Stores & Products */}
        {cart.map(store => {
          // 判定該店鋪是否被全選
          const isStoreSelected = store.products.length > 0 && store.products.every(p => selectedIds.has(p.id));

          return (
            <div key={store.storeId} className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-100 w-full">
              
              {/* Store Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-teal-500 cursor-pointer rounded border-gray-300 focus:ring-teal-500 focus:ring-2"
                  checked={isStoreSelected}
                  onChange={() => toggleStore(store.storeId)}
                />
                <span className="font-semibold text-gray-800">{store.storeName}</span>
              </div>

              {/* Product Rows */}
              <div className="flex flex-col">
                {store.products.map((product, index) => (
                  <div key={product.id} className={`grid grid-cols-12 gap-4 items-center p-4 hover:bg-gray-50 transition-colors ${index !== store.products.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    
                    {/* Product Info */}
                    <div className="col-span-5 flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-teal-500 flex-shrink-0 cursor-pointer rounded border-gray-300 focus:ring-teal-500 focus:ring-2"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleProduct(product.id)}
                      />
                      <img src={product.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-gray-900 truncate mb-1 font-medium">{product.name}</span>
                        {('customizations' in product || 'userRemark' in product) && (
                          <div className="text-gray-500 text-xs mb-1.5 font-medium leading-tight whitespace-normal">
                            {[...((product as any).customizations || []), (product as any).userRemark ? `備註: ${(product as any).userRemark}` : null]
                              .filter(Boolean)
                              .join(' / ')}
                          </div>
                        )}
                        <div className="flex items-center">
                           <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block w-max border border-orange-100">
                            🔥 {product.variant.split(',')[0]}
                          </span>
                          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block w-max border border-blue-100 ml-2">
                            🥩 {product.variant.split(',')[1].trim()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="col-span-2 flex flex-col items-center justify-center">
                      <span className="text-gray-800 font-medium">${product.price.toLocaleString()}</span>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2 flex justify-center">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <button 
                          className="p-1 px-3 hover:bg-gray-100 text-gray-600 transition-colors"
                          onClick={() => updateQuantity(store.storeId, product.id, -1)}
                        >
                          <Minus size={16} />
                        </button>
                        <input 
                          type="text" 
                          readOnly 
                          value={product.quantity} 
                          className="w-10 text-center text-sm outline-none border-x border-gray-200 h-full bg-transparent text-gray-900 font-medium" 
                        />
                        <button 
                          className="p-1 px-3 hover:bg-gray-100 text-gray-600 transition-colors"
                          onClick={() => updateQuantity(store.storeId, product.id, 1)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Total Price (Row) */}
                    <div className="col-span-2 text-right font-medium text-teal-600">
                      ${(product.price * product.quantity).toLocaleString()}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex flex-col items-center gap-2">
                      <button 
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => deleteItem(store.storeId, product.id)}
                        title="刪除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {cart.length === 0 && (
          <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            您的健康餐點購物車目前是空的
          </div>
        )}
      </div>

      {/* Sticky Bottom Checkout Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10 w-full rounded-t-xl -mx-4 md:-mx-8 lg:-mx-12 px-4 md:px-8 lg:px-12 flex flex-col">
        {/* Smart Nutrition Feedback */}
        {selectedIds.size > 0 && (
          <div className="w-full flex justify-center py-3 bg-teal-50/50 border-b border-teal-100 px-4 gap-4 flex-wrap text-sm">
            {feedbackMessages.map((msg, idx) => (
              <span key={idx} className={`flex items-center gap-1 bg-white px-2 py-1 rounded shadow-sm border ${
                msg.type === 'danger' ? 'border-red-100' :
                msg.type === 'warning' ? 'border-orange-100' :
                msg.type === 'success' ? 'border-teal-100' :
                msg.type === 'info' ? 'border-blue-100' : 'border-gray-100'
              } ${msg.color}`}>
                {msg.type === 'danger' && <AlertTriangle className="w-4 h-4" />}
                {msg.text}
              </span>
            ))}
          </div>
        )}

        <div className="w-full flex justify-between items-center py-4 max-w-[1200px] mx-auto">
          
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-600 hover:text-gray-900 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-teal-500 cursor-pointer rounded border-gray-300 focus:ring-teal-500 focus:ring-2"
                checked={isAllSelected}
                onChange={toggleAll}
              />
              全選 ({allProductIds.length})
            </label>
            <button 
              className="text-sm text-gray-500 hover:text-red-500 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Trash2 size={16} /> 刪除
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">
                總金額 <span className="text-gray-400">({totalCount} 個餐點)</span>
              </div>
              <div className="text-2xl font-bold text-teal-600">
                ${totalPrice.toLocaleString()}
              </div>
            </div>
            <button 
              onClick={() => {
                // Collect selected items
                const selectedItems: CheckoutData['items'] = [];
                cart.forEach(store => {
                  store.products.forEach(p => {
                    if (selectedIds.has(p.id)) {
                      const options: string[] = [];
                      if ((p as any).customizations) options.push(...(p as any).customizations);
                      if ((p as any).userRemark) options.push(`備註: ${(p as any).userRemark}`);
                      
                      selectedItems.push({
                        itemName: p.name,
                        quantity: p.quantity,
                        price: p.price,
                        customOptions: options.length > 0 ? options : undefined,
                        imageUrl: p.imageUrl,
                        storeName: store.storeName,
                      });
                    }
                  });
                });
                
                trackEvent('checkout', {
                  amount: totalPrice,
                  metadata: {
                    itemsCount: totalCount,
                    selectedItemsCount: selectedItems.length
                  }
                });

                onCheckout?.({ itemsCount: totalCount, subtotal: totalPrice, items: selectedItems });
              }}
              disabled={selectedIds.size === 0}
              className={`px-10 py-3.5 rounded-xl text-lg font-bold transition-all shadow-sm ${
                selectedIds.size > 0 
                  ? 'bg-teal-500 text-white hover:bg-teal-600 active:scale-95' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              去買單
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
