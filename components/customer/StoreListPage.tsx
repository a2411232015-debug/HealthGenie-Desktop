import React, { useMemo, useState } from 'react';
import { Bike, Clock, LocateFixed, MapPin, Search, ShoppingBag, Store } from 'lucide-react';
import { fetchOpenMerchants } from '../../lib/api';
import { useQuery } from '../../lib/useQuery';
import { Merchant } from '../../types';
import { describeToday } from '../../utils/hours';
import { distanceKm, formatDistance, getSavedLocation, requestLocation, Coordinates } from '../../utils/geo';
import { showToast } from '../../utils/notifications';
import { formatCurrency } from '../../utils/pricing';
import { Badge, EmptyState, ErrorState, hideBrokenImage, inputClass, PageHeader, PageLoading, secondaryButton } from '../ui';
import { orderingMode, STORE_STATE_LABEL, storeState } from './storeStatus';

const StoreCard: React.FC<{ merchant: Merchant; distance: number | null }> = ({ merchant, distance }) => {
  const state = storeState(merchant);
  return (
    <a href={`#/store/${merchant.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg">
      <div className="relative h-36 bg-gradient-to-br from-teal-100 to-emerald-50">
        {merchant.coverImageUrl
          ? <img src={merchant.coverImageUrl} alt="" className={`h-full w-full object-cover ${state === 'open' ? '' : 'grayscale'}`} loading="lazy" onError={hideBrokenImage} />
          : <div className="flex h-full items-center justify-center text-teal-300"><Store className="h-14 w-14" /></div>}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${state === 'open' ? 'bg-emerald-500 text-white' : 'bg-slate-800/80 text-white'}`}>
          {STORE_STATE_LABEL[state]}{state === 'closed' && orderingMode(merchant) === 'preorder' ? '・可預約' : ''}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="text-lg font-black text-slate-900 group-hover:text-teal-700">{merchant.name}</h2>
        {merchant.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{merchant.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {merchant.pickupEnabled && <Badge tone="teal"><ShoppingBag className="h-3 w-3" />自取</Badge>}
          {merchant.deliveryEnabled && <Badge tone="blue"><Bike className="h-3 w-3" />外送 {formatCurrency(merchant.deliveryFee)}</Badge>}
          {merchant.minOrderAmount > 0 && <Badge>滿 {formatCurrency(merchant.minOrderAmount)} 起送</Badge>}
        </div>
        <div className="mt-auto space-y-1 pt-3 text-xs text-slate-500">
          <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{describeToday(merchant.openingHours)}</p>
          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{merchant.address}</span>
            {distance !== null && <span className="shrink-0 font-bold text-teal-700">· {formatDistance(distance)}</span>}
          </p>
        </div>
      </div>
    </a>
  );
};

export const StoreListPage: React.FC = () => {
  const merchants = useQuery(fetchOpenMerchants, []);
  const [search, setSearch] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(getSavedLocation);
  const [locating, setLocating] = useState(false);

  const list = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const rank = { open: 0, paused: 1, closed: 2 };
    return (merchants.data || [])
      .map((merchant) => ({
        merchant,
        distance: location && merchant.lat !== null && merchant.lng !== null
          ? distanceKm(location, { lat: merchant.lat, lng: merchant.lng })
          : null,
      }))
      .filter(({ merchant }) => !keyword || `${merchant.name} ${merchant.description} ${merchant.address}`.toLowerCase().includes(keyword))
      .filter(({ merchant }) => !openOnly || storeState(merchant) === 'open')
      .sort((a, b) => rank[storeState(a.merchant)] - rank[storeState(b.merchant)]
        || (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [merchants.data, search, openOnly, location]);

  const locate = async () => {
    setLocating(true);
    try {
      setLocation(await requestLocation());
    } catch (error) {
      showToast(error instanceof Error ? error.message : '無法取得位置', 'error');
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="今天想吃什麼？" subtitle="選一間店，看看健康又好吃的餐點" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">搜尋店家</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-9`} placeholder="搜尋店名、地址" />
        </label>
        <button onClick={() => setOpenOnly((value) => !value)} className={`${secondaryButton} ${openOnly ? 'border-teal-500 bg-teal-50 text-teal-700' : ''}`}>只看營業中</button>
        <button onClick={locate} disabled={locating} className={secondaryButton}>
          <LocateFixed className="h-4 w-4" /> {location ? '更新我的位置' : '顯示距離'}
        </button>
      </div>

      {merchants.loading && !merchants.data ? <PageLoading /> : merchants.error ? (
        <ErrorState message={merchants.error} onRetry={() => void merchants.reload()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Store className="h-12 w-12" />}
          title={(merchants.data || []).length === 0 ? '目前還沒有合作店家' : '找不到符合的店家'}
          text={(merchants.data || []).length === 0 ? '平台審核通過的店家會顯示在這裡。' : '換個關鍵字試試看。'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ merchant, distance }) => <StoreCard key={merchant.id} merchant={merchant} distance={distance} />)}
        </div>
      )}
    </div>
  );
};
