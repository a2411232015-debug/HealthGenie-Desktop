import React, { useEffect, useState } from 'react';
import { BarChart3, ClipboardList, Settings, Store, UtensilsCrossed } from 'lucide-react';
import { applyAsMerchant, updateMerchant } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { navigate } from '../../lib/router';
import { useAutoRefresh } from '../../lib/useQuery';
import { errorMessage, showToast } from '../../utils/notifications';
import { Badge, PageHeader, PageLoading } from '../ui';
import { MenuManager } from './MenuManager';
import { MerchantOrders } from './MerchantOrders';
import { MerchantStats } from './MerchantStats';
import { emptyMerchantInput, merchantToInput, StoreSettingsForm } from './StoreSettingsForm';

const TABS = [
  { key: 'orders', label: '接單', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'menu', label: '菜單', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { key: 'settings', label: '店家設定', icon: <Settings className="h-4 w-4" /> },
  { key: 'stats', label: '營運數據', icon: <BarChart3 className="h-4 w-4" /> },
];

const STATUS_BADGE = {
  pending: <Badge tone="amber">審核中</Badge>,
  approved: <Badge tone="green">已上線</Badge>,
  rejected: <Badge tone="red">未通過審核</Badge>,
  suspended: <Badge tone="red">已停權</Badge>,
};

export const MerchantPage: React.FC<{ tab: string }> = ({ tab }) => {
  const { userId, merchant, loading, setMerchant, refreshMerchant } = useAuth();
  const [toggling, setToggling] = useState(false);

  // 審核狀態可能被平台管理員更新：切換分頁時與每分鐘重新讀取
  useEffect(() => {
    void refreshMerchant().catch(() => undefined);
  }, [refreshMerchant, tab]);
  useAutoRefresh(() => void refreshMerchant().catch(() => undefined), 60000);

  useEffect(() => {
    if (loading) return;
    if (!merchant && tab !== 'apply') navigate('/merchant/apply', { replace: true });
    if (merchant && (tab === 'apply' || !TABS.some((entry) => entry.key === tab))) navigate('/merchant/orders', { replace: true });
  }, [loading, merchant, tab]);

  if (loading) return <PageLoading />;

  if (!merchant) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="成為合作店家" subtitle="填寫店家資料送出申請，平台審核通過後顧客就能看到你的店。審核期間可以先建立菜單。" />
        <StoreSettingsForm
          initial={emptyMerchantInput()}
          submitLabel="送出申請"
          onSubmit={async (input) => {
            const created = await applyAsMerchant(userId || '', input);
            setMerchant(created);
            showToast('申請已送出！可以先建立菜單');
            navigate('/merchant/menu');
          }}
        />
      </div>
    );
  }

  const toggleAccepting = async () => {
    setToggling(true);
    try {
      const updated = await updateMerchant(merchant.id, { acceptingOrders: !merchant.acceptingOrders });
      setMerchant(updated);
      showToast(updated.acceptingOrders ? '已恢復接單' : '已暫停接單，顧客暫時無法下單');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={merchant.name}
        subtitle={<span className="flex items-center gap-2"><Store className="h-4 w-4" />商家後台 {STATUS_BADGE[merchant.status]}</span>}
        actions={(
          <button onClick={toggleAccepting} disabled={toggling} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-bold ${merchant.acceptingOrders ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`} role="switch" aria-checked={merchant.acceptingOrders}>
            <span className={`relative h-5 w-9 rounded-full transition ${merchant.acceptingOrders ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${merchant.acceptingOrders ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            {merchant.acceptingOrders ? '接單中' : '暫停接單'}
          </button>
        )}
      />

      {merchant.status === 'pending' && <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">店家正在審核中，通過後顧客才看得到你的店。你可以先把菜單建立好。</p>}
      {merchant.status === 'rejected' && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">申請未通過{merchant.reviewNote ? `：${merchant.reviewNote}` : ''}。請到「店家設定」修改資料，儲存後會自動重新送審。</p>}
      {merchant.status === 'suspended' && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">店家已被平台暫停{merchant.reviewNote ? `：${merchant.reviewNote}` : ''}，顧客目前看不到你的店。請聯絡平台管理員。</p>}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="商家後台">
        {TABS.map((entry) => (
          <a key={entry.key} href={`#/merchant/${entry.key}`} className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${tab === entry.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {entry.icon}{entry.label}
          </a>
        ))}
      </nav>

      {tab === 'orders' && <MerchantOrders merchant={merchant} />}
      {tab === 'menu' && <MenuManager merchant={merchant} />}
      {tab === 'stats' && <MerchantStats merchant={merchant} />}
      {tab === 'settings' && (
        <div className="max-w-3xl">
          <StoreSettingsForm
            key={merchant.id}
            initial={merchantToInput(merchant)}
            submitLabel="儲存店家設定"
            onSubmit={async (input) => {
              const updated = await updateMerchant(merchant.id, input);
              setMerchant(updated);
              showToast(merchant.status === 'rejected' && updated.status === 'pending' ? '已儲存並重新送出審核' : '店家設定已儲存');
            }}
          />
        </div>
      )}
    </div>
  );
};
