import React, { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, CirclePause, Phone, ShieldCheck, Store, CircleX } from 'lucide-react';
import { fetchAllMerchants, fetchTodayOrderCount, setMerchantStatus } from '../../lib/api';
import { useQuery } from '../../lib/useQuery';
import { Merchant, MerchantStatus } from '../../types';
import { formatDateTime, startOfTaipeiDay } from '../../utils/format';
import { describeToday } from '../../utils/hours';
import { errorMessage, showToast } from '../../utils/notifications';
import { formatCurrency } from '../../utils/pricing';
import { Badge, EmptyState, ErrorState, PageHeader, PageLoading, ReasonDialog, card, primaryButton, secondaryButton } from '../ui';

const FILTERS: { key: MerchantStatus | 'all'; label: string }[] = [
  { key: 'pending', label: '待審核' },
  { key: 'approved', label: '已上線' },
  { key: 'rejected', label: '未通過' },
  { key: 'suspended', label: '已停權' },
  { key: 'all', label: '全部' },
];

const STATUS_TONE: Record<MerchantStatus, 'amber' | 'green' | 'red'> = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'red' };
const STATUS_LABEL: Record<MerchantStatus, string> = { pending: '待審核', approved: '已上線', rejected: '未通過', suspended: '已停權' };

export const AdminPage: React.FC = () => {
  const query = useQuery(async () => {
    const [merchants, todayOrders] = await Promise.all([fetchAllMerchants(), fetchTodayOrderCount(startOfTaipeiDay())]);
    return { merchants, todayOrders };
  }, []);
  const [filter, setFilter] = useState<MerchantStatus | 'all'>('pending');
  const [busyId, setBusyId] = useState('');
  const [reasonFor, setReasonFor] = useState<{ merchant: Merchant; status: MerchantStatus } | null>(null);

  const merchants = query.data?.merchants || [];
  const counts = useMemo(() => merchants.reduce<Record<string, number>>((result, merchant) => ({ ...result, [merchant.status]: (result[merchant.status] || 0) + 1 }), {}), [merchants]);
  const list = merchants.filter((merchant) => filter === 'all' || merchant.status === filter);

  const change = async (merchant: Merchant, status: MerchantStatus, note = '') => {
    setBusyId(merchant.id);
    try {
      const updated = await setMerchantStatus(merchant.id, status, note);
      query.setData((current) => ({ todayOrders: current?.todayOrders || 0, merchants: (current?.merchants || []).map((item) => (item.id === updated.id ? updated : item)) }));
      showToast(`「${merchant.name}」${STATUS_LABEL[status]}`);
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusyId('');
      setReasonFor(null);
    }
  };

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="平台管理" subtitle={<span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />審核店家、管理上架狀態</span>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${card} p-4`}><p className="text-xs font-bold text-slate-500">待審核</p><p className="mt-1 text-2xl font-black text-amber-600">{counts.pending || 0}</p></div>
        <div className={`${card} p-4`}><p className="text-xs font-bold text-slate-500">上線店家</p><p className="mt-1 text-2xl font-black text-slate-900">{counts.approved || 0}</p></div>
        <div className={`${card} p-4`}><p className="text-xs font-bold text-slate-500">今日訂單</p><p className="mt-1 text-2xl font-black text-slate-900">{query.data?.todayOrders || 0}</p></div>
        <div className={`${card} p-4`}><p className="text-xs font-bold text-slate-500">停權／退件</p><p className="mt-1 text-2xl font-black text-slate-900">{(counts.suspended || 0) + (counts.rejected || 0)}</p></div>
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-max">
        {FILTERS.map((entry) => (
          <button key={entry.key} onClick={() => setFilter(entry.key)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold ${filter === entry.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
            {entry.label}{entry.key !== 'all' && counts[entry.key] ? ` (${counts[entry.key]})` : ''}
          </button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState icon={<Store className="h-12 w-12" />} title="沒有符合的店家" /> : (
        <div className="space-y-3">
          {list.map((merchant) => (
            <article key={merchant.id} className={`${card} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">{merchant.name}<Badge tone={STATUS_TONE[merchant.status]}>{STATUS_LABEL[merchant.status]}</Badge></h2>
                  <p className="text-xs text-slate-400">申請時間 {formatDateTime(merchant.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {merchant.status !== 'approved' && (
                    <button onClick={() => change(merchant, 'approved')} disabled={busyId === merchant.id} className={primaryButton}><CheckCircle2 className="h-4 w-4" />{merchant.status === 'suspended' ? '恢復上線' : '核准上線'}</button>
                  )}
                  {merchant.status === 'pending' && (
                    <button onClick={() => setReasonFor({ merchant, status: 'rejected' })} disabled={busyId === merchant.id} className={`${secondaryButton} text-red-600`}><CircleX className="h-4 w-4" />退件</button>
                  )}
                  {merchant.status === 'approved' && (
                    <button onClick={() => setReasonFor({ merchant, status: 'suspended' })} disabled={busyId === merchant.id} className={`${secondaryButton} text-red-600`}><CirclePause className="h-4 w-4" />停權</button>
                  )}
                </div>
              </div>
              {merchant.description && <p className="mt-2 text-sm text-slate-600">{merchant.description}</p>}
              <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{merchant.phone}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{merchant.address}</p>
                <p className="text-xs text-slate-500">{describeToday(merchant.openingHours)} · {merchant.pickupEnabled ? '自取' : ''}{merchant.pickupEnabled && merchant.deliveryEnabled ? '／' : ''}{merchant.deliveryEnabled ? `外送 ${formatCurrency(merchant.deliveryFee)}` : ''}</p>
                <p className="text-xs text-slate-500">服務費 {formatCurrency(merchant.serviceFee)} · 每單折 {formatCurrency(merchant.discount)} · 最低消費 {formatCurrency(merchant.minOrderAmount)}</p>
              </div>
              {merchant.reviewNote && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">審核備註：{merchant.reviewNote}</p>}
              {merchant.status === 'approved' && <a href={`#/store/${merchant.id}`} className="mt-3 inline-block text-sm font-bold text-teal-700 hover:underline">查看顧客看到的店家頁 →</a>}
            </article>
          ))}
        </div>
      )}
      {reasonFor && (
        <ReasonDialog
          title={reasonFor.status === 'rejected' ? `退件「${reasonFor.merchant.name}」` : `停權「${reasonFor.merchant.name}」`}
          description="店家會在後台看到這個說明。"
          presets={reasonFor.status === 'rejected' ? ['地址不完整', '電話無法聯絡', '店家資料與實際不符', '請補上營業時間'] : ['多次無故拒單', '顧客檢舉', '食品安全疑慮', '店家申請暫停']}
          confirmLabel={reasonFor.status === 'rejected' ? '確定退件' : '確定停權'}
          busy={busyId === reasonFor.merchant.id}
          onCancel={() => setReasonFor(null)}
          onConfirm={(note) => void change(reasonFor.merchant, reasonFor.status, note)}
        />
      )}
    </div>
  );
};
