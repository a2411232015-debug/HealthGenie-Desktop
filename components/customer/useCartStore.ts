import { useEffect, useState } from 'react';
import { fetchMerchant, fetchProducts } from '../../lib/api';
import { refreshCartPrices, useCart } from '../../lib/cart';
import { useQuery } from '../../lib/useQuery';
import { Cart, Merchant, Product } from '../../types';

export interface CartStore {
  cart: Cart;
  merchant: Merchant | null;
  products: Product[];
  unavailable: Set<string>;
  loading: boolean;
  error: string | null;
  priceChanged: boolean;
  reload: () => Promise<void>;
}

/** 讀取購物車店家的最新資料，並用最新菜單重新計算購物車 */
export const useCartStore = (): CartStore => {
  const cart = useCart();
  const query = useQuery(async () => {
    if (!cart.merchantId) return { merchant: null, products: [] as Product[] };
    const merchant = await fetchMerchant(cart.merchantId);
    const products = merchant ? await fetchProducts([merchant.id]) : [];
    return { merchant, products };
  }, [cart.merchantId]);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [priceChanged, setPriceChanged] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    if (!query.data.merchant) {
      setUnavailable(new Set(cart.items.map((item) => item.key)));
      return;
    }
    const result = refreshCartPrices(query.data.products);
    setUnavailable(result.unavailable);
    if (result.changed) setPriceChanged(true);
    // 只在讀到新菜單時重新計算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  return {
    cart,
    merchant: query.data?.merchant || null,
    products: query.data?.products || [],
    unavailable: new Set([...unavailable].filter((key) => cart.items.some((item) => item.key === key))),
    loading: query.loading,
    error: query.error,
    priceChanged,
    reload: () => query.reload(true),
  };
};
