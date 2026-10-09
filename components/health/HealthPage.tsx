import React, { useMemo, useState } from 'react';
import { BookPlus, Flame, HeartPulse, Plus, Scale, Trash2, UtensilsCrossed } from 'lucide-react';
import { addFoodLog, deleteFoodLog, fetchFoodLogs, fetchLoggedOrderIds, fetchMyOrders, fetchWeightLogs, saveWeight } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notifyFoodLogsUpdated } from '../../lib/health';
import { useQuery } from '../../lib/useQuery';
import { FoodLog, Order } from '../../types';
import { calculateHealthTargets } from '../../utils/health';
import { formatTime, startOfTaipeiDay, taipeiDate } from '../../utils/format';
import { errorMessage, showToast } from '../../utils/notifications';
import { addNutrition, emptyNutrition } from '../../utils/pricing';
import { WeightChart } from '../WeightChart';
import { EmptyState, ErrorState, PageHeader, PageLoading, Spinner, card, inputClass, primaryButton, secondaryButton } from '../ui';
import { FoodLogModal } from './FoodLogModal';

const SOURCE_LABEL: Record<FoodLog['source'], string> = { manual: '手動', order: '訂單', photo: 'AI 照片' };

const Progress: React.FC<{ label: string; value: number; target: number; unit: string; color: string }> = ({ label, value, target, unit, color }) => {
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="font-bold text-slate-700">{label}</span><span className="text-slate-500">{Math.round(value)} / {target} {unit}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div>
    </div>
  );
};

const orderTotals = (order: Order) => order.items.reduce((sum, item) => addNutrition(sum, item.unitNutrition, item.quantity), emptyNutrition());

export const HealthPage: React.FC = () => {
  const { userId, profile } = useAuth();
  const targets = calculateHealthTargets(profile?.health);
  const weekStart = useMemo(() => startOfTaipeiDay(new Date(Date.now() - 6 * 86400000)), []);
  const query = useQuery(async () => {
    const [logs, weights, orders] = await Promise.all([fetchFoodLogs(weekStart), fetchWeightLogs(), fetchMyOrders(userId || '')]);
    const recentCompleted = orders.filter((order) => order.status === 'completed' && order.completedAt
      && Date.now() - new Date(order.completedAt).getTime() < 36 * 3600000
      && order.items.some((item) => item.unitNutrition));
    const logged = await fetchLoggedOrderIds(recentCompleted.map((order) => order.id));
    return { logs, weights, unloggedOrders: recentCompleted.filter((order) => !logged.has(order.id)).slice(0, 3) };
  }, [userId, weekStart], Boolean(userId));
  const [showLog, setShowLog] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [busyId, setBusyId] = useState('');

  const today = taipeiDate();
  const todayLogs = (query.data?.logs || []).filter((log) => taipeiDate(new Date(log.eatenAt)) === today);
  const consumed = todayLogs.reduce((sum, log) => ({
    calories: sum.calories + log.calories,
    protein: sum.protein + (log.protein || 0),
    fat: sum.fat + (log.fat || 0),
    carbs: sum.carbs + (log.carbs || 0),
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = taipeiDate(new Date(Date.now() - (6 - index) * 86400000));
    const total = (query.data?.logs || []).filter((log) => taipeiDate(new Date(log.eatenAt)) === date).reduce((sum, log) => sum + log.calories, 0);
    return { date, total };
  }), [query.data]);
  const weekMax = Math.max(targets?.dailyCalories || 0, ...week.map((day) => day.total), 1);

  const removeLog = async (log: FoodLog) => {
    setBusyId(log.id);
    try {
      await deleteFoodLog(log.id);
      query.setData((current) => current ? { ...current, logs: current.logs.filter((item) => item.id !== log.id) } : current!);
      notifyFoodLogsUpdated();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusyId('');
    }
  };

  const logOrder = async (order: Order) => {
    setBusyId(order.id);
    try {
      const totals = orderTotals(order);
      const log = await addFoodLog({
        name: `${order.merchantName}：${order.items.map((item) => item.name).join('、')}`.slice(0, 60),
        calories: Math.round(totals.calories),
        protein: totals.protein,
        fat: totals.fat,
        carbs: totals.carbs,
        source: 'order',
        orderId: order.id,
        eatenAt: order.completedAt || undefined,
      });
      query.setData((current) => current ? { ...current, logs: [log, ...current.logs], unloggedOrders: current.unloggedOrders.filter((item) => item.id !== order.id) } : current!);
      notifyFoodLogsUpdated();
      showToast('已記錄這一餐');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusyId('');
    }
  };

  const submitWeight = async (event: React.FormEvent) => {
    event.preventDefault();
    const weight = Number(weightInput);
    if (!userId || !Number.isFinite(weight) || weight < 20 || weight > 400) {
      showToast('請輸入 20–400 公斤之間的體重', 'error');
      return;
    }
    setSavingWeight(true);
    try {
      await saveWeight(userId, Math.round(weight * 10) / 10, today);
      setWeightInput('');
      showToast('今天的體重已記錄');
      void query.reload(true);
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSavingWeight(false);
    }
  };

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;

  const weights = (query.data?.weights || []).slice(-90);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`${profile?.displayName ? `${profile.displayName}，` : ''}今天吃得好嗎？`}
        subtitle={new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'long' })}
        actions={<button onClick={() => setShowLog(true)} className={primaryButton}><Plus className="h-4 w-4" />記錄飲食</button>}
      />

      {!targets && (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <HeartPulse className="h-8 w-8 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-900">填寫性別、年齡、身高、體重和活動量，就能算出你每天適合吃多少熱量。</p>
          <a href="#/me" className={secondaryButton}>填寫健康資料</a>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${card} p-5 lg:col-span-1`}>
          <h2 className="flex items-center gap-2 font-black text-slate-900"><Flame className="h-5 w-5 text-orange-500" />今日攝取</h2>
          <p className="mt-4 text-4xl font-black text-slate-900">{consumed.calories}<span className="ml-1 text-base font-bold text-slate-400">kcal</span></p>
          {targets ? (
            <>
              <p className={`text-sm font-bold ${consumed.calories > targets.dailyCalories ? 'text-red-600' : 'text-teal-700'}`}>
                {consumed.calories > targets.dailyCalories ? `超過目標 ${consumed.calories - targets.dailyCalories} kcal` : `還可以吃 ${targets.dailyCalories - consumed.calories} kcal`}
              </p>
              <div className="mt-5 space-y-4">
                <Progress label="熱量" value={consumed.calories} target={targets.dailyCalories} unit="kcal" color="bg-orange-400" />
                <Progress label="蛋白質" value={consumed.protein} target={targets.macros.protein} unit="g" color="bg-blue-500" />
                <Progress label="碳水" value={consumed.carbs} target={targets.macros.carbs} unit="g" color="bg-amber-400" />
                <Progress label="脂肪" value={consumed.fat} target={targets.macros.fat} unit="g" color="bg-emerald-500" />
              </div>
              <p className="mt-4 text-xs text-slate-400">每日目標依 Mifflin-St Jeor 公式估算（TDEE {targets.tdee} kcal），僅供參考。</p>
            </>
          ) : <p className="mt-2 text-sm text-slate-500">填寫健康資料後會顯示每日目標。</p>}
          <a href="#/recommend" className={`${secondaryButton} mt-5 w-full`}>看看適合我的餐點</a>
        </section>

        <section className={`${card} p-5 lg:col-span-2`}>
          <h2 className="font-black text-slate-900">今天吃了什麼</h2>
          {(query.data?.unloggedOrders || []).map((order) => (
            <div key={order.id} className="mt-3 flex items-center gap-3 rounded-xl bg-teal-50 px-4 py-3">
              <UtensilsCrossed className="h-5 w-5 shrink-0 text-teal-600" />
              <p className="min-w-0 flex-1 text-sm text-teal-900"><b>{order.merchantName}</b> 的訂單已完成（約 {Math.round(orderTotals(order).calories)} kcal），要記錄嗎？</p>
              <button onClick={() => logOrder(order)} disabled={busyId === order.id} className={`${primaryButton} shrink-0 px-3 py-1.5`}>{busyId === order.id ? <Spinner className="h-4 w-4" /> : <BookPlus className="h-4 w-4" />}記錄</button>
            </div>
          ))}
          {todayLogs.length === 0 ? (
            <div className="mt-3"><EmptyState title="今天還沒有紀錄" text="點右上角「記錄飲食」，或在訂單完成後一鍵記錄。" /></div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {todayLogs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 py-3">
                  <span className="w-12 shrink-0 text-xs text-slate-400">{formatTime(log.eatenAt)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800">{log.name}</p>
                    <p className="text-xs text-slate-500">
                      {SOURCE_LABEL[log.source]}
                      {log.protein !== null && ` · 蛋白質 ${Math.round(log.protein)}g`}
                      {log.carbs !== null && ` · 碳水 ${Math.round(log.carbs)}g`}
                    </p>
                  </div>
                  <span className="shrink-0 font-black text-orange-600">{log.calories} kcal</span>
                  <button onClick={() => removeLog(log)} disabled={busyId === log.id} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`刪除 ${log.name}`}>
                    {busyId === log.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-bold text-slate-500">最近 7 天</h3>
          <div className="mt-3 flex h-32 items-end gap-2" role="img" aria-label="最近 7 天熱量長條圖">
            {week.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{day.total || ''}</span>
                <div className={`w-full rounded-t-md ${targets && day.total > targets.dailyCalories ? 'bg-red-300' : 'bg-teal-400'}`} style={{ height: `${Math.max(2, (day.total / weekMax) * 96)}px` }} />
                <span className="text-[10px] text-slate-500">{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8, 10))}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-black text-slate-900"><Scale className="h-5 w-5 text-teal-600" />體重紀錄</h2>
          <form onSubmit={submitWeight} className="flex w-full items-center gap-2 sm:w-auto">
            <label htmlFor="weight-today" className="sr-only">今天的體重</label>
            <input id="weight-today" type="number" step="0.1" inputMode="decimal" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} placeholder="今天幾公斤？" className={`${inputClass} min-w-0 flex-1 sm:w-36 sm:flex-none`} />
            <button type="submit" disabled={savingWeight || !weightInput} className={`${primaryButton} shrink-0 whitespace-nowrap`}>{savingWeight && <Spinner className="h-4 w-4" />}記錄</button>
          </form>
        </div>
        {weights.length >= 2
          ? <div className="mt-4"><WeightChart data={weights} targetWeight={Number(profile?.health.targetWeight) || weights[weights.length - 1].weight} /></div>
          : <p className="mt-4 text-sm text-slate-500">記錄兩天以上的體重，就會顯示趨勢圖。{weights.length === 1 && `目前紀錄：${weights[0].weight} kg`}</p>}
      </section>

      {showLog && <FoodLogModal onClose={() => setShowLog(false)} onSaved={(log) => query.setData((current) => current ? { ...current, logs: [log, ...current.logs] } : current!)} />}
    </div>
  );
};
