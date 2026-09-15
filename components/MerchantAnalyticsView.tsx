import React, { useEffect, useState } from 'react';
import { Download, LineChart } from 'lucide-react';
import { getAnalyticsSummary, AnalyticsSummary } from '../utils/merchantAnalytics';
import { formatCurrency } from '../utils/pricing';
import { showToast } from '../utils/notifications';

interface MerchantAnalyticsViewProps {
  merchantId: string;
}

const SERIES = [
  { key: 'impressions', label: '曝光次數', color: '#0f766e' },
  { key: 'clicks', label: '商品點擊數', color: '#2563eb' },
  { key: 'navigations', label: '導航次數', color: '#7c3aed' },
  { key: 'orders', label: '訂單數', color: '#ea580c' },
] as const;

export const MerchantAnalyticsView: React.FC<MerchantAnalyticsViewProps> = ({ merchantId }) => {
  const [summary, setSummary] = useState<AnalyticsSummary>(() => getAnalyticsSummary(merchantId));

  useEffect(() => {
    const load = () => setSummary(getAnalyticsSummary(merchantId));
    window.addEventListener('analytics_updated', load);
    window.addEventListener('orders_updated', load);
    return () => {
      window.removeEventListener('analytics_updated', load);
      window.removeEventListener('orders_updated', load);
    };
  }, [merchantId]);

  const hasTrendData = summary.dailyTrend.some((point) =>
    SERIES.some((series) => point[series.key] > 0),
  );
  const maxValue = Math.max(1, ...summary.dailyTrend.flatMap((point) =>
    SERIES.map((series) => point[series.key]),
  ));
  const axisMax = Math.max(4, Math.ceil(maxValue / 4) * 4);
  const width = 700;
  const height = 260;
  const left = 48;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const downloadReport = () => {
    const rows = [
      ['日期', '曝光次數', '商品點擊數', '導航次數', '訂單數'],
      ...summary.dailyTrend.map((point) => [
        point.date,
        String(point.impressions),
        String(point.clicks),
        String(point.navigations),
        String(point.orders),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `healthgenie-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('完整報表已下載');
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">營運數據總覽</h2>
          <p className="text-slate-500 text-sm mt-1">趨勢區間：最近 7 天</p>
        </div>
        <button onClick={downloadReport} className="text-teal-700 text-sm font-bold bg-teal-50 px-4 py-2 rounded-lg flex items-center gap-2">
          <Download className="w-4 h-4" /> 下載完整報表
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          ['總曝光數', summary.impressions.toLocaleString(), '潛在觸及客群'],
          ['商品點擊', summary.clicks.toLocaleString(), `轉換率 ${summary.conversionRate}%`],
          ['導航次數', summary.navigations.toLocaleString(), '高意圖到店顧客'],
          ['有效訂單', summary.validOrdersCount.toLocaleString(), `平均 ${formatCurrency(summary.averageOrderValue)}`],
        ].map(([label, value, description]) => (
          <div key={label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">{label}</p>
            <p className="text-3xl font-black text-slate-800 mt-2">{value}</p>
            <p className="text-xs text-slate-400 mt-2">{description}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <LineChart className="w-5 h-5 text-teal-600" /> 過去 7 天流量趨勢
          </h3>
          {!hasTrendData ? (
            <div className="h-64 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl mt-5 border border-dashed border-slate-200 px-4">
              <p className="font-bold text-slate-600">目前尚無足夠的流量資料</p>
              <p className="text-sm text-slate-400 mt-2">開始上架餐點後，系統會在此顯示趨勢。</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 mt-4 text-xs font-bold">
                {SERIES.map((series) => (
                  <span key={series.key} className="flex items-center gap-1.5">
                    <span className="w-3 h-1 rounded-full" style={{ backgroundColor: series.color }} />
                    {series.label}
                  </span>
                ))}
              </div>
              <div className="w-full overflow-hidden mt-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-h-64" role="img" aria-label="最近七天流量折線圖">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = (axisMax / 4) * index;
                    const y = top + plotHeight - (value / axisMax) * plotHeight;
                    return (
                      <g key={value}>
                        <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                        <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{Math.round(value)}</text>
                      </g>
                    );
                  })}
                  {summary.dailyTrend.map((point, index) => {
                    const x = left + (index / Math.max(1, summary.dailyTrend.length - 1)) * plotWidth;
                    return <text key={point.isoDate} x={x} y={height - 14} textAnchor="middle" fontSize="11" fill="#64748b">{point.date}</text>;
                  })}
                  {SERIES.map((series) => {
                    const points = summary.dailyTrend.map((point, index) => {
                      const x = left + (index / Math.max(1, summary.dailyTrend.length - 1)) * plotWidth;
                      const y = top + plotHeight - (point[series.key] / axisMax) * plotHeight;
                      return { x, y, value: point[series.key], date: point.date };
                    });
                    return (
                      <g key={series.key}>
                        <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={series.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                        {points.map((point) => (
                          <circle key={`${point.date}-${series.key}`} cx={point.x} cy={point.y} r="4" fill="white" stroke={series.color} strokeWidth="3">
                            <title>{point.date} · {series.label}：{point.value}</title>
                          </circle>
                        ))}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800">熱門餐點排行</h3>
          {summary.topMeals.length > 0 ? (
            <div className="space-y-5 mt-5">
              {summary.topMeals.map((meal, index) => (
                <div key={meal.name}>
                  <div className="flex justify-between gap-3 text-sm font-bold">
                    <span>#{index + 1} {meal.name}</span>
                    <span className="text-emerald-500">{meal.growth}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">已售 {meal.quantity} 份 · {formatCurrency(meal.revenue)}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 text-center py-12">尚無餐點銷售資料</p>}
        </section>
      </div>

      <section className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-5">
        <div>
          <h3 className="font-bold text-lg">本月結算預覽</h3>
          <p className="text-slate-400 text-sm mt-1">已排除取消與拒絕訂單</p>
        </div>
        <div className="flex gap-6">
          <div><p className="text-xs text-slate-400">平台服務費</p><p className="text-xl font-bold mt-1">-{formatCurrency(summary.platformFee)}</p></div>
          <div><p className="text-xs text-emerald-400">商家實收</p><p className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(summary.netRevenue)}</p></div>
        </div>
      </section>
    </div>
  );
};
