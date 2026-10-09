import React, { useMemo, useState } from 'react';
import { LocateFixed, Sparkles } from 'lucide-react';
import { fetchOpenMerchants, fetchProducts } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTodayIntake } from '../../lib/health';
import { useQuery } from '../../lib/useQuery';
import { ALLERGENS, Merchant, Product } from '../../types';
import { Coordinates, distanceKm, formatDistance, getSavedLocation, requestLocation } from '../../utils/geo';
import { showToast } from '../../utils/notifications';
import { formatCurrency } from '../../utils/pricing';
import { Badge, EmptyState, ErrorState, PageHeader, PageLoading, card, secondaryButton } from '../ui';
import { ProductCard } from './StorePage';
import { ProductModal } from './ProductModal';
import { storeState } from './storeStatus';

interface Candidate {
  product: Product;
  merchant: Merchant;
  distance: number | null;
  score: number;
  reasons: string[];
}

export const RecommendPage: React.FC = () => {
  const { session } = useAuth();
  const intake = useTodayIntake();
  const query = useQuery(async () => {
    const merchants = await fetchOpenMerchants();
    const products = await fetchProducts(merchants.map((merchant) => merchant.id));
    return { merchants, products };
  }, []);
  const [maxPrice, setMaxPrice] = useState(300);
  const [highProtein, setHighProtein] = useState(false);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [location, setLocation] = useState<Coordinates | null>(getSavedLocation);
  const [selected, setSelected] = useState<Candidate | null>(null);

  const remaining = intake.targets ? Math.max(0, intake.targets.dailyCalories - intake.consumedCalories) : null;

  const candidates = useMemo<Candidate[]>(() => {
    if (!query.data) return [];
    const merchantById = new Map(query.data.merchants.map((merchant) => [merchant.id, merchant]));
    return query.data.products.flatMap((product) => {
      const merchant = merchantById.get(product.merchantId);
      if (!merchant || !product.available) return [];
      if (openOnly && storeState(merchant) !== 'open') return [];
      if (product.price > maxPrice) return [];
      if (avoid.some((allergen) => product.allergens.includes(allergen))) return [];
      const calories = product.nutrition.calories;
      const protein = product.nutrition.protein ?? 0;
      if (highProtein && protein < 25) return [];
      const reasons: string[] = [];
      let score = 0;
      if (calories !== undefined) {
        score += 10;
        if (remaining !== null) {
          if (calories <= remaining) {
            score += 20;
            reasons.push('在今日熱量預算內');
          } else {
            score -= 30;
          }
        }
        if (calories > 0) score += Math.min(30, (protein / calories) * 300);
      }
      if (protein >= 25) reasons.push('高蛋白');
      if ((product.nutrition.fiber ?? 0) >= 5) reasons.push('高纖');
      if ((product.nutrition.sodium ?? 0) > 0 && (product.nutrition.sodium ?? 0) <= 600) reasons.push('低鈉');
      score += reasons.length * 3;
      const distance = location && merchant.lat !== null && merchant.lng !== null
        ? distanceKm(location, { lat: merchant.lat, lng: merchant.lng })
        : null;
      if (distance !== null) score -= distance * 3;
      return [{ product, merchant, distance, score, reasons }];
    }).sort((a, b) => b.score - a.score).slice(0, 60);
  }, [query.data, maxPrice, highProtein, avoid, openOnly, remaining, location]);

  const locate = async () => {
    try {
      setLocation(await requestLocation());
    } catch (error) {
      showToast(error instanceof Error ? error.message : '無法取得位置', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="健康推薦"
        subtitle={remaining !== null
          ? <>今天還可以吃 <b className="text-teal-700">{remaining} kcal</b>（目標 {intake.targets?.dailyCalories} kcal，已記錄 {intake.consumedCalories} kcal）</>
          : session
            ? <>到「我的帳戶」填寫身高體重，就能依你的熱量需求推薦。<a href="#/me" className="ml-1 font-bold text-teal-700 hover:underline">去填寫</a></>
            : <>登入並填寫身高體重後，可以依你的熱量需求推薦。</>}
      />

      <section className={`${card} mb-6 space-y-4 p-5`}>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex-1 text-sm font-bold text-slate-700">
            預算上限：{formatCurrency(maxPrice)}
            <input type="range" min={50} max={500} step={10} value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} className="mt-2 w-full accent-teal-600" />
          </label>
          <button onClick={() => setHighProtein((value) => !value)} className={`${secondaryButton} ${highProtein ? 'border-teal-500 bg-teal-50 text-teal-700' : ''}`}>高蛋白（≥25g）</button>
          <button onClick={() => setOpenOnly((value) => !value)} className={`${secondaryButton} ${openOnly ? 'border-teal-500 bg-teal-50 text-teal-700' : ''}`}>只看營業中</button>
          <button onClick={locate} className={secondaryButton}><LocateFixed className="h-4 w-4" />{location ? '更新位置' : '依距離排序'}</button>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-slate-500">避開過敏原</p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((allergen) => {
              const active = avoid.includes(allergen);
              return (
                <button key={allergen} onClick={() => setAvoid((current) => active ? current.filter((value) => value !== allergen) : [...current, allergen])} className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {active ? '✕ ' : ''}{allergen}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {query.loading && !query.data ? <PageLoading /> : query.error ? (
        <ErrorState message={query.error} onRetry={() => void query.reload()} />
      ) : candidates.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-12 w-12" />} title="找不到符合條件的餐點" text="試著放寬預算，或取消「只看營業中」。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map((candidate) => (
            <ProductCard
              key={candidate.product.id}
              product={candidate.product}
              subtitle={`${candidate.merchant.name}${candidate.distance !== null ? ` · ${formatDistance(candidate.distance)}` : ''}`}
              extra={candidate.reasons.slice(0, 2).map((reason) => <Badge key={reason} tone="green">{reason}</Badge>)}
              onOpen={() => setSelected(candidate)}
            />
          ))}
        </div>
      )}
      {selected && <ProductModal product={selected.product} merchant={selected.merchant} onClose={() => setSelected(null)} />}
    </div>
  );
};
