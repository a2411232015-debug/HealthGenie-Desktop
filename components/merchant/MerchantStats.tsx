import React, { useMemo, useState } from 'react';
import { fetchMerchantOrders } from '../../lib/api';
import { useQuery } from '../../lib/useQuery';
import { Merchant } from '../../types';
import { startOfTaipeiDay, taipeiDate } from '../../utils/format';
import { formatCurrency } from '../../utils/pricing';
import { EmptyState, ErrorState, PageLoading, card } from '../ui';

const RANGES = [7, 30] as const;

export const MerchantStats: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const since = useMemo(() => startOfTaipeiDay(new Date(Date.now() - (days - 1) * 86400000)), [days]);
  const query = useQuery(() => fetchMerchantOrders(merchant.id, since), [merchant.id, since]);

  const stats = useMemo(() => {
    const orders = query.data || [];
    const completed = orders.filter((order) => order.status === 'completed');
    const lost = orders.filter((order) => order.status === 'cancelled' || order.status === 'rejected');
    const revenue = completed.reduce((sum, order) => sum + order.total, 0);
    const daily = Array.from({ length: days }, (_, index) => {
      const date = taipeiDate(new Date(Date.now() - (days - 1 - index) * 86400000));
      const dayOrders = completed.filter((order) => taipeiDate(new Date(order.createdAt)) === date);
      return { date, revenue: dayOrders.reduce((sum, order) => sum + order.total, 0), count: dayOrders.length };
    });
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    completed.forEach((order) => order.items.forEach((item) => {
      const current = itemMap.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
      itemMap.set(item.productId, { name: item.name, quantity: current.quantity + item.quantity, revenue: current.revenue + item.subtotal });
    }));
    const hours = Array.from({ length: 24 }, (_, hour) => completed.filter((order) => Number(new Date(order.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: '2-digit', hourCycle: 'h23' })) === hour).length);
    return {
      total: orders.length,
      completed: completed.length,
      revenue,
      average: completed.length ? Math.round(revenue / completed.length) : 0,
      lostRate: orders.length ? Math.round((lost.length / orders.length) * 100) : 0,
      daily,
      topItems: [...itemMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      hours,
    };
  }, [query.data, days]);

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;
  const maxRevenue = Math.max(1, ...stats.daily.map((day) => day.revenue));
  const maxHour = Math.max(1, ...stats.hours);
  const busyHours = stats.hours.map((count, hour) => ({ hour, count })).filter((entry) => entry.count > 0);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 sm:w-max">
        {RANGES.map((range) => (
          <button key={range} onClick={() => setDays(range)} className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${days === range ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>最近 {range} 天</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['完成訂單營收', formatCurrency(stats.revenue)],
          ['完成訂單數', `${stats.completed} 張`],
          ['平均客單價', formatCurrency(stats.average)],
          ['取消／拒單比例', `${stats.lostRate}%`],
        ].map(([label, value]) => (
          <div key={label} className={`${card} p-4`}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>
        ))}
      </div>
      {stats.total === 0 ? <EmptyState title="這段期間還沒有訂單" text="有訂單後，這裡會顯示營收、熱賣餐點和尖峰時段。" /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={`${card} p-5`}>
            <h3 className="font-black text-slate-900">每日營收</h3>
            <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="每日營收長條圖">
              {stats.daily.map((day) => (
                <div key={day.date} className="group flex flex-1 flex-col items-center gap-1" title={`${day.date}：${formatCurrency(day.revenue)}（${day.count} 張）`}>
                  <div className="w-full rounded-t bg-teal-400 group-hover:bg-teal-600" style={{ height: `${Math.max(2, (day.revenue / maxRevenue) * 140)}px` }} />
                  {(days === 7 || Number(day.date.slice(8, 10)) % 5 === 0) && <span className="text-[10px] text-slate-500">{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8, 10))}</span>}
                </div>
              ))}
            </div>
          </section>
          <section className={`${card} p-5`}>
            <h3 className="font-black text-slate-900">熱賣餐點</h3>
            <ol className="mt-3 space-y-2">
              {stats.topItems.map((item, index) => (
                <li key={item.name} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-xs font-black text-teal-700">{index + 1}</span>
                  <span className="flex-1 font-bold text-slate-800">{item.name}</span>
                  <span className="text-slate-500">{item.quantity} 份 · {formatCurrency(item.revenue)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className={`${card} p-5 lg:col-span-2`}>
            <h3 className="font-black text-slate-900">下單時段</h3>
            <p className="text-xs text-slate-500">可以依尖峰時段安排備料與人力。</p>
            <div className="mt-4 flex h-24 items-end gap-0.5">
              {stats.hours.map((count, hour) => (
                <div key={hour} className="flex flex-1 flex-col items-center gap-1" title={`${hour}:00–${hour + 1}:00：${count} 張`}>
                  <div className={`w-full rounded-t ${count ? 'bg-orange-300' : 'bg-slate-100'}`} style={{ height: `${Math.max(2, (count / maxHour) * 80)}px` }} />
                  {hour % 3 === 0 && <span className="text-[10px] text-slate-400">{hour}</span>}
                </div>
              ))}
            </div>
            {busyHours.length > 0 && <p className="mt-3 text-sm text-slate-600">最忙的時段：{[...busyHours].sort((a, b) => b.count - a.count).slice(0, 2).map((entry) => `${entry.hour}:00`).join('、')}</p>}
          </section>
        </div>
      )}
    </div>
  );
};
