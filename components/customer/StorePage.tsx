import React, { useMemo, useState } from 'react';
import { Bike, Clock, MapPin, Phone, ShoppingBag, Store, UtensilsCrossed } from 'lucide-react';
import { fetchMerchant, fetchProducts } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useQuery } from '../../lib/useQuery';
import { Merchant, Product } from '../../types';
import { describeDay, WEEKDAY_LABELS, taipeiClock } from '../../utils/hours';
import { formatNumber } from '../../utils/format';
import { formatCurrency } from '../../utils/pricing';
import { Badge, EmptyState, ErrorState, hideBrokenImage, PageLoading } from '../ui';
import { ProductModal } from './ProductModal';
import { orderingMode, STORE_STATE_LABEL, storeState } from './storeStatus';

export const ProductCard: React.FC<{ product: Product; subtitle?: string; extra?: React.ReactNode; onOpen: () => void }> = ({ product, subtitle, extra, onOpen }) => (
  <button type="button" onClick={onOpen} className={`flex w-full gap-4 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition ${product.available ? 'hover:border-teal-200 hover:shadow-md' : 'opacity-60'}`}>
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
      {product.imageUrl
        ? <img src={product.imageUrl} alt="" className={`h-full w-full object-cover ${product.available ? '' : 'grayscale'}`} loading="lazy" onError={hideBrokenImage} />
        : <div className="flex h-full items-center justify-center text-slate-300"><UtensilsCrossed className="h-8 w-8" /></div>}
      {!product.available && <span className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-xs font-bold text-white">已售完</span>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <h3 className="font-bold text-slate-900">{product.name}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      {product.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{product.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
        <span className="mr-1 font-black text-teal-700">{formatCurrency(product.price)}</span>
        {product.nutrition.calories !== undefined && <Badge tone="amber">{formatNumber(product.nutrition.calories, 'kcal')}</Badge>}
        {product.nutrition.protein !== undefined && <Badge tone="blue">蛋白質 {formatNumber(product.nutrition.protein, 'g')}</Badge>}
        {extra}
      </div>
    </div>
  </button>
);

const MerchantHeader: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const state = storeState(merchant);
  const today = taipeiClock(new Date()).day;
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="relative h-40 bg-gradient-to-br from-teal-100 to-emerald-50 md:h-52">
        {merchant.coverImageUrl
          ? <img src={merchant.coverImageUrl} alt="" className="h-full w-full object-cover" onError={hideBrokenImage} />
          : <div className="flex h-full items-center justify-center text-teal-300"><Store className="h-16 w-16" /></div>}
      </div>
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-slate-900">{merchant.name}</h1>
          <Badge tone={state === 'open' ? 'green' : 'slate'}>{STORE_STATE_LABEL[state]}</Badge>
        </div>
        {merchant.description && <p className="mt-2 text-sm text-slate-600">{merchant.description}</p>}
        <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{merchant.address}</p>
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" /><a href={`tel:${merchant.phone}`} className="hover:underline">{merchant.phone}</a></p>
          <details className="md:col-span-2">
            <summary className="flex cursor-pointer items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-slate-400" />今日 {describeDay(merchant.openingHours, today)}（查看每週營業時間）</summary>
            <ul className="mt-2 grid grid-cols-1 gap-1 pl-6 text-xs sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <li key={day} className={day === today ? 'font-bold text-teal-700' : ''}>{WEEKDAY_LABELS[day]}：{describeDay(merchant.openingHours, day)}</li>
              ))}
            </ul>
          </details>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {merchant.pickupEnabled && <Badge tone="teal"><ShoppingBag className="h-3 w-3" />可自取</Badge>}
          {merchant.deliveryEnabled && <Badge tone="blue"><Bike className="h-3 w-3" />外送費 {formatCurrency(merchant.deliveryFee)}</Badge>}
          {merchant.serviceFee > 0 && <Badge>服務費 {formatCurrency(merchant.serviceFee)}</Badge>}
          {merchant.discount > 0 && <Badge tone="green">每單折 {formatCurrency(merchant.discount)}</Badge>}
          {merchant.minOrderAmount > 0 && <Badge>最低消費 {formatCurrency(merchant.minOrderAmount)}</Badge>}
          <Badge>約 {merchant.prepMinutes} 分鐘完成</Badge>
        </div>
        {state !== 'open' && (
          <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            {state === 'paused' ? '店家目前暫停接單，可以先看看菜單。' : orderingMode(merchant) === 'preorder' ? '現在休息中，可以先預約今天或明天的營業時間取餐。' : '現在不是營業時間，營業時間內才能下單。'}
          </p>
        )}
      </div>
    </section>
  );
};

export const StorePage: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const query = useQuery(async () => {
    const merchant = await fetchMerchant(merchantId);
    const products = merchant ? await fetchProducts([merchant.id]) : [];
    return { merchant, products };
  }, [merchantId]);
  const [selected, setSelected] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const groups = new Map<string, Product[]>();
    (query.data?.products || []).forEach((product) => {
      const key = product.category || '餐點';
      groups.set(key, [...(groups.get(key) || []), product]);
    });
    return [...groups.entries()];
  }, [query.data]);

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;
  const merchant = query.data?.merchant;
  if (!merchant) return <ErrorState message="找不到這間店家，可能已經下架" onRetry={() => navigate('/stores')} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <a href="#/stores" className="text-sm font-bold text-teal-700 hover:underline">← 所有店家</a>
      <MerchantHeader merchant={merchant} />
      {categories.length > 1 && (
        <nav className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-slate-50/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0" aria-label="菜單分類">
          {categories.map(([name]) => (
            <a key={name} href={`#/store/${merchant.id}`} onClick={(event) => { event.preventDefault(); document.getElementById(`cat-${name}`)?.scrollIntoView({ behavior: 'smooth' }); }} className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-bold text-slate-600 hover:border-teal-300">
              {name}
            </a>
          ))}
        </nav>
      )}
      {categories.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-12 w-12" />} title="店家還沒有上架餐點" />
      ) : categories.map(([name, products]) => (
        <section key={name} id={`cat-${name}`} className="scroll-mt-16">
          <h2 className="mb-3 text-lg font-black text-slate-800">{name}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {products.map((product) => <ProductCard key={product.id} product={product} onOpen={() => setSelected(product)} />)}
          </div>
        </section>
      ))}
      {selected && <ProductModal product={selected} merchant={merchant} onClose={() => setSelected(null)} />}
    </div>
  );
};
